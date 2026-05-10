import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, proxyToTcdmx, deductBalance, acquireSlot, releaseSlot, estimateMaxCost } from "@/lib/proxy";

export const maxDuration = 120;

// Responses API (used by OpenAI Codex CLI, VS Code Copilot, etc.)
// Mirrors /v1/chat/completions logic but proxies to TCDMX /v1/responses.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const userKey = authHeader.replace("Bearer ", "").trim();

  if (!userKey) {
    return NextResponse.json(
      { error: { message: "Missing API key", type: "authentication_error", code: "missing_api_key" } },
      { status: 401 }
    );
  }

  const { valid, apiKey, error } = await validateApiKey(userKey);
  if (!valid || !apiKey) {
    return NextResponse.json(
      { error: { message: error, type: "authentication_error", code: "invalid_api_key" } },
      { status: 401 }
    );
  }

  const { getClientIp, parseAclList, ipMatchesAny } = await import("@/lib/ip-acl");
  const clientIp = getClientIp(req);
  const blacklist = parseAclList(apiKey.ipBlacklist);
  if (blacklist.length > 0 && ipMatchesAny(clientIp, blacklist)) {
    return NextResponse.json({ error: { message: "IP blocked", type: "authentication_error", code: "ip_blocked" } }, { status: 403 });
  }
  const whitelist = parseAclList(apiKey.ipWhitelist);
  if (whitelist.length > 0 && !ipMatchesAny(clientIp, whitelist)) {
    return NextResponse.json({ error: { message: "IP not allowed", type: "authentication_error", code: "ip_not_allowed" } }, { status: 403 });
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json({ error: { message: "API key has expired", type: "authentication_error", code: "key_expired" } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-4o-mini";
  const isStream = body.stream === true;

  const { prisma: db } = await import("@/lib/db");
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const since5h = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (apiKey.user.planExpiresAt && apiKey.user.planExpiresAt < now && apiKey.user.dailyLimit > 0) {
    await db.user.update({ where: { id: apiKey.user.id }, data: { dailyLimit: 0, planExpiresAt: null, currentPlanId: null } });
    apiKey.user.dailyLimit = 0;
  }

  const planActive = apiKey.user.dailyLimit > 0 && apiKey.user.planExpiresAt != null && apiKey.user.planExpiresAt >= now;
  const [userDayUsage, keyDayUsage, key5hUsage, key7dUsage, keyTotalUsage] = await Promise.all([
    planActive || apiKey.user.dailyLimit > 0
      ? db.usageLog.aggregate({ where: { userId: apiKey.user.id, createdAt: { gte: today } }, _sum: { cost: true } }) : null,
    apiKey.limitDaily && apiKey.limitDaily > 0
      ? db.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: today } }, _sum: { cost: true } }) : null,
    apiKey.limit5h && apiKey.limit5h > 0
      ? db.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: since5h } }, _sum: { cost: true } }) : null,
    apiKey.limit7d && apiKey.limit7d > 0
      ? db.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: since7d } }, _sum: { cost: true } }) : null,
    apiKey.quotaLimit && apiKey.quotaLimit > 0
      ? db.usageLog.aggregate({ where: { apiKeyId: apiKey.id }, _sum: { cost: true } }) : null,
  ]);

  const planDailyUsed = userDayUsage ? (userDayUsage._sum.cost || 0) : 0;
  const planHasCredits = planActive && planDailyUsed < apiKey.user.dailyLimit;

  const redeemActive = apiKey.user.redeemBalance > 0
    && apiKey.user.redeemExpiresAt != null
    && apiKey.user.redeemExpiresAt > now;
  if (apiKey.user.redeemExpiresAt && apiKey.user.redeemExpiresAt < now && apiKey.user.redeemBalance > 0) {
    await db.user.update({ where: { id: apiKey.user.id }, data: { redeemBalance: 0, redeemExpiresAt: null } });
    apiKey.user.redeemBalance = 0;
  }

  if (!redeemActive && !planHasCredits && apiKey.user.balance <= 0) {
    const msg = planActive ? "Gói đã hết hạn mức ngày và số dư không đủ. Vui lòng nạp thêm credit." : "Insufficient balance. Please top up.";
    return NextResponse.json({ error: { message: msg, type: "billing_error", code: "insufficient_balance" } }, { status: 402 });
  }

  const planRoomNow = planHasCredits ? Math.max(0, apiKey.user.dailyLimit - planDailyUsed) : 0;
  const totalAvailable = (redeemActive ? apiKey.user.redeemBalance : 0) + planRoomNow + Math.max(0, apiKey.user.balance);
  const estMaxCost = await estimateMaxCost(model, body);
  if (estMaxCost > totalAvailable) {
    return NextResponse.json({
      error: {
        message: `Estimated max cost $${estMaxCost.toFixed(4)} exceeds available funds $${totalAvailable.toFixed(4)}. Lower max_tokens or top up.`,
        type: "billing_error", code: "max_cost_exceeds_funds",
        estimatedMaxCost: estMaxCost, available: totalAvailable,
      },
    }, { status: 402 });
  }

  if (keyDayUsage && (keyDayUsage._sum.cost || 0) >= apiKey.limitDaily!)
    return NextResponse.json({ error: { message: "API key daily limit reached.", type: "billing_error", code: "key_daily_limit_exceeded" } }, { status: 429 });
  if (key5hUsage && (key5hUsage._sum.cost || 0) >= apiKey.limit5h!)
    return NextResponse.json({ error: { message: "API key 5-hour limit reached.", type: "billing_error", code: "key_5h_limit_exceeded" } }, { status: 429 });
  if (key7dUsage && (key7dUsage._sum.cost || 0) >= apiKey.limit7d!)
    return NextResponse.json({ error: { message: "API key 7-day limit reached.", type: "billing_error", code: "key_7d_limit_exceeded" } }, { status: 429 });
  if (keyTotalUsage && (keyTotalUsage._sum.cost || 0) >= apiKey.quotaLimit!)
    return NextResponse.json({ error: { message: "API key quota limit reached.", type: "billing_error", code: "key_quota_exceeded" } }, { status: 429 });

  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });

  const slot = await acquireSlot(apiKey.user.id, apiKey.user.currentPlanId);
  if (!slot.ok) {
    return NextResponse.json({ error: { message: `Concurrency limit reached (${slot.current}/${slot.limit}).`, type: "rate_limit", code: "concurrency_exceeded" } }, { status: 429 });
  }

  try {
    const upstream = await proxyToTcdmx(
      "/v1/responses",
      "POST",
      body,
      Object.fromEntries(req.headers.entries()),
      apiKey.user.id
    );

    if (!upstream.ok) {
      releaseSlot(apiKey.user.id);
      const errText = await upstream.text();
      return new NextResponse(errText, { status: upstream.status, headers: { "Content-Type": "application/json" } });
    }

    if (isStream) {
      const { readable, writable } = new TransformStream();
      let inputTokens = 0;
      let outputTokens = 0;
      let cachedTokens = 0;
      let outputCharCount = 0;

      const writer = writable.getWriter();
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();

      (async () => {
        let receivedAnyData = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            receivedAnyData = true;
            const chunk = decoder.decode(value, { stream: true });

            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
              try {
                const data = JSON.parse(line.slice(6));
                // Responses API: usage may be on `response.completed` event payload
                const usage = data.usage || data.response?.usage;
                if (usage) {
                  inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
                  outputTokens = usage.output_tokens || usage.completion_tokens || 0;
                  cachedTokens = usage.input_tokens_details?.cached_tokens
                    || usage.prompt_tokens_details?.cached_tokens
                    || usage.cache_read_input_tokens
                    || 0;
                }
                // Track output text deltas (Responses API uses response.output_text.delta event)
                const delta = data.delta || data.choices?.[0]?.delta?.content;
                if (typeof delta === "string") outputCharCount += delta.length;
              } catch { /* skip malformed */ }
            }

            await writer.write(value);
          }
        } catch {
          reader.cancel().catch(() => null);
        } finally {
          writer.close().catch(() => null);
          releaseSlot(apiKey.user.id);
          if (receivedAnyData) {
            if (outputTokens === 0 && outputCharCount > 0) {
              outputTokens = Math.max(1, Math.ceil(outputCharCount / 4));
              console.error(JSON.stringify({ ts: new Date().toISOString(), event: "missing_stream_usage", userId: apiKey.user.id, model, charCount: outputCharCount, estimatedOutput: outputTokens }));
            }
            if (outputTokens > 0) {
              try {
                await deductBalance(apiKey.user.id, apiKey.id, model, inputTokens, outputTokens, cachedTokens);
              } catch (e) {
                console.error(JSON.stringify({ ts: new Date().toISOString(), event: "deduct_failed", userId: apiKey.user.id, model, err: String(e) }));
              }
            }
          }
        }
      })();

      return new NextResponse(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    } else {
      try {
        const data = await upstream.json();
        const usage = data.usage || {};
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const cachedTokens = usage.input_tokens_details?.cached_tokens
          || usage.prompt_tokens_details?.cached_tokens
          || usage.cache_read_input_tokens
          || 0;
        try {
          await deductBalance(apiKey.user.id, apiKey.id, model, inputTokens, outputTokens, cachedTokens);
        } catch (e) {
          console.error(JSON.stringify({ ts: new Date().toISOString(), event: "deduct_failed", userId: apiKey.user.id, model, err: String(e) }));
        }
        return NextResponse.json(data);
      } finally {
        releaseSlot(apiKey.user.id);
      }
    }
  } catch (err) {
    releaseSlot(apiKey.user.id);
    const msg = err instanceof Error ? err.message : "Gateway error";
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: "proxy_error", userId: apiKey.user.id, keyId: apiKey.id, model, msg }));
    return NextResponse.json({ error: { message: msg, type: "server_error" } }, { status: 502 });
  }
}
