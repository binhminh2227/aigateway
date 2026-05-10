import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, proxyToTcdmx, deductBalance, acquireSlot, releaseSlot, estimateMaxCost } from "@/lib/proxy";

export const maxDuration = 180;

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
    return NextResponse.json({ error: { message: "IP blocked" } }, { status: 403 });
  }
  const whitelist = parseAclList(apiKey.ipWhitelist);
  if (whitelist.length > 0 && !ipMatchesAny(clientIp, whitelist)) {
    return NextResponse.json({ error: { message: "IP not allowed" } }, { status: 403 });
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json({ error: { message: "API key expired" } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 }); }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "gpt-image-2";

  // Block if all 3 sources empty: redeem, plan, top-up balance
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const since5h = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { prisma: pdb } = await import("@/lib/db");

  // Auto-reset dailyLimit if plan has expired
  if (apiKey.user.planExpiresAt && apiKey.user.planExpiresAt < now && apiKey.user.dailyLimit > 0) {
    await pdb.user.update({ where: { id: apiKey.user.id }, data: { dailyLimit: 0, planExpiresAt: null, currentPlanId: null } });
    apiKey.user.dailyLimit = 0;
  }
  if (apiKey.user.redeemExpiresAt && apiKey.user.redeemExpiresAt < now && apiKey.user.redeemBalance > 0) {
    await pdb.user.update({ where: { id: apiKey.user.id }, data: { redeemBalance: 0, redeemExpiresAt: null } });
    apiKey.user.redeemBalance = 0;
  }

  const planActive = apiKey.user.dailyLimit > 0 && apiKey.user.planExpiresAt != null && apiKey.user.planExpiresAt >= now;
  const [userDayUsage, keyDayUsage, key5hUsage, key7dUsage, keyTotalUsage] = await Promise.all([
    planActive
      ? pdb.usageLog.aggregate({ where: { userId: apiKey.user.id, createdAt: { gte: today } }, _sum: { cost: true } })
      : null,
    apiKey.limitDaily && apiKey.limitDaily > 0
      ? pdb.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: today } }, _sum: { cost: true } })
      : null,
    apiKey.limit5h && apiKey.limit5h > 0
      ? pdb.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: since5h } }, _sum: { cost: true } })
      : null,
    apiKey.limit7d && apiKey.limit7d > 0
      ? pdb.usageLog.aggregate({ where: { apiKeyId: apiKey.id, createdAt: { gte: since7d } }, _sum: { cost: true } })
      : null,
    apiKey.quotaLimit && apiKey.quotaLimit > 0
      ? pdb.usageLog.aggregate({ where: { apiKeyId: apiKey.id }, _sum: { cost: true } })
      : null,
  ]);

  const planDailyUsed = userDayUsage ? (userDayUsage._sum.cost || 0) : 0;
  const planHasCredits = planActive && planDailyUsed < apiKey.user.dailyLimit;
  const redeemActive = apiKey.user.redeemBalance > 0 && apiKey.user.redeemExpiresAt != null && apiKey.user.redeemExpiresAt > now;

  if (!redeemActive && !planHasCredits && apiKey.user.balance <= 0) {
    return NextResponse.json(
      { error: { message: "Insufficient balance. Please top up.", type: "billing_error", code: "insufficient_balance" } },
      { status: 402 }
    );
  }

  // Pre-charge gate: ensure user has at least the max possible cost before calling upstream.
  // For flat-cost models this returns flatCost*markup; for token-based models it estimates from prompt size.
  const maxCost = await estimateMaxCost(model, body);
  if (!isFinite(maxCost)) {
    return NextResponse.json(
      { error: { message: `Model "${model}" is not configured. Contact admin.`, type: "invalid_request_error", code: "model_not_configured" } },
      { status: 400 }
    );
  }
  const planRoom = planActive ? Math.max(0, apiKey.user.dailyLimit - planDailyUsed) : 0;
  const totalAvailable = (redeemActive ? apiKey.user.redeemBalance : 0) + planRoom + Math.max(0, apiKey.user.balance);
  if (totalAvailable < maxCost) {
    return NextResponse.json(
      { error: { message: `Insufficient funds. Need ~$${maxCost.toFixed(4)} but have $${totalAvailable.toFixed(4)}.`, type: "billing_error", code: "insufficient_balance" } },
      { status: 402 }
    );
  }

  // Key-level rate limits
  if (keyDayUsage && (keyDayUsage._sum.cost || 0) >= apiKey.limitDaily!)
    return NextResponse.json({ error: { message: "API key daily limit reached.", type: "billing_error", code: "key_daily_limit_exceeded" } }, { status: 429 });
  if (key5hUsage && (key5hUsage._sum.cost || 0) >= apiKey.limit5h!)
    return NextResponse.json({ error: { message: "API key 5-hour limit reached.", type: "billing_error", code: "key_5h_limit_exceeded" } }, { status: 429 });
  if (key7dUsage && (key7dUsage._sum.cost || 0) >= apiKey.limit7d!)
    return NextResponse.json({ error: { message: "API key 7-day limit reached.", type: "billing_error", code: "key_7d_limit_exceeded" } }, { status: 429 });
  if (keyTotalUsage && (keyTotalUsage._sum.cost || 0) >= apiKey.quotaLimit!)
    return NextResponse.json({ error: { message: "API key quota reached.", type: "billing_error", code: "key_quota_exceeded" } }, { status: 429 });

  const { prisma } = await import("@/lib/db");
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });

  const slot = await acquireSlot(apiKey.user.id, apiKey.user.currentPlanId);
  if (!slot.ok) {
    return NextResponse.json(
      { error: { message: `Concurrency limit reached (${slot.current}/${slot.limit}).`, type: "rate_limit", code: "concurrency_exceeded" } },
      { status: 429 }
    );
  }

  try {
    const upstream = await proxyToTcdmx(
      "/v1/images/generations",
      "POST",
      body,
      Object.fromEntries(req.headers.entries()),
      apiKey.user.id
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new NextResponse(errText, { status: upstream.status, headers: { "Content-Type": "application/json" } });
    }

    const data = await upstream.json();
    const usage = data.usage || {};
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;

    // Always deduct on success — image models are commonly flat-billed and TCDMX
    // may not return a usage block. calculateCost handles flat vs token internally.
    try {
      await deductBalance(apiKey.user.id, apiKey.id, model, inputTokens, outputTokens);
    } catch (e) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), event: "deduct_failed", userId: apiKey.user.id, model, err: String(e) }));
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gateway error";
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: "image_proxy_error", userId: apiKey.user.id, model, msg }));
    return NextResponse.json({ error: { message: msg, type: "server_error" } }, { status: 502 });
  } finally {
    releaseSlot(apiKey.user.id);
  }
}
