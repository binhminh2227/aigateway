import { prisma } from "./db";
import { logger } from "./logger";
import { sha256, decryptSecret } from "./crypto";

function validateBaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (!["https:", "http:"].includes(u.protocol)) throw new Error("Bad protocol");
    const blocked = ["localhost", "127.0.0.1", "::1", "0.0.0.0", "169.254.169.254"];
    if (blocked.some(h => u.hostname === h || u.hostname.endsWith(".local"))) {
      throw new Error("SSRF: internal host blocked");
    }
    return raw.replace(/\/+$/, "");
  } catch (e) {
    logger.error("invalid_tcdmx_base_url", { raw, err: String(e) });
    throw new Error("TCDMX_BASE_URL is invalid or points to an internal host");
  }
}

const TCDMX_BASE_URL = validateBaseUrl(process.env.TCDMX_BASE_URL || "https://tcdmx.com");

// ── Pricing (always read from DB, no cache) ────────────────────────────────
interface PricingEntry { tcdmxInput: number; tcdmxOutput: number; tcdmxCache: number; tier: number; markup: number; flatCost: number | null; }

export function invalidatePricingCache() { /* no-op, kept for backwards compat */ }

// ── Per-user concurrency tracker ───────────────────────────────────────────
const inflightByUser = new Map<string, number>();
const DEFAULT_CONCURRENCY = 5;

export async function acquireSlot(userId: string, currentPlanId: string | null): Promise<{ ok: true } | { ok: false; limit: number; current: number }> {
  let limit = DEFAULT_CONCURRENCY;
  if (currentPlanId) {
    const plan = await prisma.plan.findUnique({ where: { id: currentPlanId }, select: { concurrencyLimit: true } });
    if (plan && plan.concurrencyLimit > 0) limit = plan.concurrencyLimit;
  }
  const current = inflightByUser.get(userId) || 0;
  if (current >= limit) return { ok: false, limit, current };
  inflightByUser.set(userId, current + 1);
  return { ok: true };
}

export function releaseSlot(userId: string) {
  const current = inflightByUser.get(userId) || 0;
  if (current <= 1) inflightByUser.delete(userId);
  else inflightByUser.set(userId, current - 1);
}

async function getPricing() {
  const rows = await prisma.modelPricing.findMany({ where: { enabled: true } });
  const pricing: Record<string, PricingEntry> = Object.fromEntries(rows.map((r) => [r.model, {
    tcdmxInput: r.tcdmxInputPrice || r.inputPrice,
    tcdmxOutput: r.tcdmxOutputPrice || r.outputPrice,
    tcdmxCache: r.tcdmxCachePrice || 0,
    tier: r.tcdmxTier || 1.0,
    markup: r.markup || 1.3,
    flatCost: r.flatCostPerCall ?? null,
  }]));
  return { pricing };
}

// ── TCDMX key pool ─────────────────────────────────────────────────────────
interface KeyEntry { id: string; key: string; errorCount: number; }
let keyPool: KeyEntry[] = [];
let keyPoolAt = 0;
const KEY_POOL_TTL = 30_000;
// Track temporarily rate-limited keys (key id → time to retry)
const rateLimitedUntil: Record<string, number> = {};

async function getKeyPool(): Promise<KeyEntry[]> {
  if (keyPool.length > 0 && Date.now() - keyPoolAt < KEY_POOL_TTL) return keyPool;
  const rows = await prisma.tcdmxKey.findMany({ where: { status: "active" }, orderBy: { createdAt: "asc" } });
  keyPool = rows.map(r => {
    let plain = r.key;
    try { plain = decryptSecret(r.key); } catch (e) {
      logger.error("tcdmx_key_decrypt_failed", { id: r.id, err: String(e) });
    }
    return { id: r.id, key: plain, errorCount: r.errorCount };
  });
  keyPoolAt = Date.now();
  return keyPool;
}

// Stable hash → integer in [0, n).
function hashToIndex(s: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

/**
 * Pick a TCDMX key for this request.
 *
 * - Skip rate-limited keys.
 * - Sort healthy keys by errorCount ascending (prefer keys without recent failures).
 * - If userId provided, pick deterministically by hash among the healthiest tier
 *   so the same user keeps hitting the same upstream key. This lets TCDMX cache
 *   the user's repeated context (system prompt, codebase) and bills cached input
 *   at ~10% the normal rate.
 */
function getAvailableKey(pool: KeyEntry[], userId?: string): KeyEntry | null {
  const now = Date.now();
  const available = pool.filter(k => !rateLimitedUntil[k.id] || rateLimitedUntil[k.id] < now);
  if (available.length === 0) return null;
  available.sort((a, b) => a.errorCount - b.errorCount);
  // Restrict to the lowest-error tier (within +2 of the min) so a flaky key doesn't
  // disrupt sticky routing for everyone.
  const minErr = available[0].errorCount;
  const healthy = available.filter(k => k.errorCount <= minErr + 2);
  if (userId && healthy.length > 0) {
    return healthy[hashToIndex(userId, healthy.length)];
  }
  return healthy[Math.floor(Math.random() * healthy.length)];
}

function markRateLimited(id: string) {
  // Back off for 60 seconds
  rateLimitedUntil[id] = Date.now() + 60_000;
  prisma.tcdmxKey.update({ where: { id }, data: { errorCount: { increment: 1 } } }).catch(() => {});
}

function markKeyUsed(id: string) {
  prisma.tcdmxKey.update({ where: { id }, data: { lastUsed: new Date() } }).catch(() => {});
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): Promise<{ tcdmxCost: number; userCost: number }> {
  const { pricing } = await getPricing();
  const p = pricing[model];
  if (!p) {
    logger.error("model_not_priced", { model });
    throw new Error(`Model "${model}" is not configured in pricing table`);
  }
  let tcdmxCost: number;
  if (p.flatCost != null && p.flatCost > 0) {
    // Flat per-call billing (e.g. TCDMX bills gpt-image-2 at a flat rate per image
    // regardless of token counts). flatCost is the actual TCDMX charge per call.
    tcdmxCost = p.flatCost;
  } else {
    // Cached tokens are charged separately at cache price (typically ~10% of input).
    // Subtract cached from total input so they aren't double-billed.
    const billableInput = Math.max(0, inputTokens - cachedTokens);
    const cacheRate = p.tcdmxCache > 0 ? p.tcdmxCache : p.tcdmxInput * 0.1;
    tcdmxCost = (
      billableInput * p.tcdmxInput
      + cachedTokens * cacheRate
      + outputTokens * p.tcdmxOutput
    ) * p.tier / 1_000_000;
  }
  const userCost = tcdmxCost * p.markup;
  return {
    tcdmxCost: parseFloat(tcdmxCost.toFixed(8)),
    userCost: parseFloat(userCost.toFixed(8)),
  };
}

export async function validateApiKey(key: string) {
  // Primary lookup: SHA-256 hash. Falls back to plaintext for unmigrated rows.
  const hash = sha256(key);
  let apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hash }, include: { user: true } });
  if (!apiKey) {
    apiKey = await prisma.apiKey.findUnique({ where: { key }, include: { user: true } });
  }
  if (!apiKey || apiKey.status !== "active") return { valid: false, error: "Invalid or inactive API key" };
  if (apiKey.user.banned) return { valid: false, error: "User account is banned" };
  return { valid: true, apiKey };
}

/**
 * Proxy a request to tcdmx, trying multiple keys on rate limit (429).
 * Returns { res, keyId } on success, throws on total failure.
 */
export async function proxyToTcdmx(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
  userId?: string
): Promise<Response> {
  const pool = await getKeyPool();

  // Fallback to env key if no DB keys configured
  if (pool.length === 0) {
    const fallbackKey = process.env.TCDMX_API_KEY || "";
    if (!fallbackKey || fallbackKey === "your-tcdmx-api-key-here") {
      throw new Error("No TCDMX API keys configured. Please add a key in Admin > TCDMX Keys.");
    }
    return fetchTcdmx(path, method, body, headers, fallbackKey);
  }

  const tried = new Set<string>();
  while (true) {
    const entry = getAvailableKey(pool.filter(k => !tried.has(k.id)), userId);
    if (!entry) {
      // All keys rate-limited or exhausted — try fallback env key
      const fallbackKey = process.env.TCDMX_API_KEY || "";
      if (fallbackKey && fallbackKey !== "your-tcdmx-api-key-here") {
        return fetchTcdmx(path, method, body, headers, fallbackKey);
      }
      throw new Error("All TCDMX keys are rate limited. Please try again later.");
    }

    tried.add(entry.id);
    const res = await fetchTcdmx(path, method, body, headers, entry.key);

    if (res.status === 429) {
      markRateLimited(entry.id);
      continue; // try next key
    }
    if (res.status === 401) {
      logger.warn("tcdmx_key_invalid", { keyId: entry.id });
      prisma.tcdmxKey.update({ where: { id: entry.id }, data: { status: "disabled", errorCount: { increment: 1 } } }).catch(() => {});
      keyPool = keyPool.filter(k => k.id !== entry.id);
      continue;
    }

    markKeyUsed(entry.id);
    return res;
  }
}

async function fetchTcdmx(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
  apiKey: string
): Promise<Response> {
  const targetUrl = `${TCDMX_BASE_URL}${path}`;
  const proxyHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (headers["user-agent"]) proxyHeaders["User-Agent"] = headers["user-agent"];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2-min hard timeout
  try {
    return await fetch(targetUrl, {
      method, headers: proxyHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Estimate the maximum possible userCost a request could incur, based on the
 * declared `max_tokens` (or sane default) and an input-token approximation
 * derived from message content length. Used as a pre-charge guard so users
 * with tiny balances cannot trigger arbitrarily expensive upstream calls.
 */
export async function estimateMaxCost(model: string, body: Record<string, unknown>): Promise<number> {
  const { pricing } = await getPricing();
  const p = pricing[model];
  if (!p) return Number.POSITIVE_INFINITY;

  if (p.flatCost != null && p.flatCost > 0) {
    return p.flatCost * p.markup;
  }

  let approxInput = 0;
  const messages = Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
  for (const m of messages) {
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") {
      approxInput += Math.ceil(content.length / 4);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") approxInput += Math.ceil(text.length / 4);
        // image/audio parts: assume ~1500 token equivalent each
        else if ((part as { type?: string }).type === "image_url" || (part as { type?: string }).type === "input_audio") {
          approxInput += 1500;
        }
      }
    }
  }
  approxInput += 200; // system/overhead

  const rawMax = body.max_tokens ?? body.max_completion_tokens;
  const maxOut = typeof rawMax === "number" && rawMax > 0 ? rawMax : 4096;

  const cost = (approxInput * p.tcdmxInput + maxOut * p.tcdmxOutput) * p.tier * p.markup / 1_000_000;
  return cost;
}

export async function deductBalance(
  userId: string,
  apiKeyId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
) {
  const { tcdmxCost, userCost } = await calculateCost(model, inputTokens, outputTokens, cachedTokens);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, redeemBalance: true, redeemExpiresAt: true, dailyLimit: true, planExpiresAt: true },
  });
  if (!user) return 0;

  const now = new Date();

  // Auto-wipe expired redeem balance
  if (user.redeemExpiresAt && user.redeemExpiresAt < now && user.redeemBalance > 0) {
    await prisma.user.update({ where: { id: userId }, data: { redeemBalance: 0, redeemExpiresAt: null } });
    user.redeemBalance = 0;
  }

  // Multi-source split: pull from redeem → plan daily room → top-up balance, in priority order.
  // Each decrement uses a CAS-style updateMany guarded by `gte: amount` so concurrent calls
  // can never push a balance negative. If the guard fails (race lost), we fall back to
  // draining whatever is currently left atomically.
  let remaining = userCost;
  let chargedRedeem = 0;
  let chargedPlan = 0;
  let chargedBalance = 0;

  const redeemActive = user.redeemBalance > 0 && user.redeemExpiresAt != null && user.redeemExpiresAt > now;
  if (redeemActive && remaining > 0) {
    const want = Math.min(remaining, user.redeemBalance);
    const r = await prisma.user.updateMany({
      where: { id: userId, redeemBalance: { gte: want } },
      data: { redeemBalance: { decrement: want } },
    });
    if (r.count > 0) {
      chargedRedeem = want;
      remaining -= want;
    } else {
      // Race lost. Drain whatever remains.
      const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { redeemBalance: true } });
      const drain = Math.min(remaining, fresh?.redeemBalance || 0);
      if (drain > 0) {
        const r2 = await prisma.user.updateMany({
          where: { id: userId, redeemBalance: { gte: drain } },
          data: { redeemBalance: { decrement: drain } },
        });
        if (r2.count > 0) { chargedRedeem = drain; remaining -= drain; }
      }
    }
  }

  const planActive = user.dailyLimit > 0 && user.planExpiresAt != null && user.planExpiresAt > now;
  if (planActive && remaining > 0) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayUsage = await prisma.usageLog.aggregate({
      where: { userId, createdAt: { gte: today } },
      _sum: { cost: true },
    });
    const usedToday = todayUsage._sum.cost || 0;
    const planRoom = Math.max(0, user.dailyLimit - usedToday);
    chargedPlan = Math.min(remaining, planRoom);
    remaining -= chargedPlan;
  }

  if (remaining > 0 && user.balance > 0) {
    const want = Math.min(remaining, user.balance);
    const r = await prisma.user.updateMany({
      where: { id: userId, balance: { gte: want } },
      data: { balance: { decrement: want } },
    });
    if (r.count > 0) {
      chargedBalance = want;
      remaining -= want;
    } else {
      const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
      const drain = Math.min(remaining, fresh?.balance || 0);
      if (drain > 0) {
        const r2 = await prisma.user.updateMany({
          where: { id: userId, balance: { gte: drain } },
          data: { balance: { decrement: drain } },
        });
        if (r2.count > 0) { chargedBalance = drain; remaining -= drain; }
      }
    }
  }

  const charged = chargedRedeem + chargedPlan + chargedBalance;
  if (remaining > 0.0001) {
    logger.warn("balance_shortfall_after_call", { userId, userCost, charged, shortfall: remaining });
  }

  await prisma.usageLog.create({
    data: { userId, apiKeyId, model, inputTokens, outputTokens, cachedTokens, cost: charged, tcdmxCost },
  });
  return charged;
}

export async function getAvailableModels() {
  const { pricing } = await getPricing();
  return Object.entries(pricing).map(([id, p]) => ({
    id, object: "model", created: 1677610602, owned_by: getProvider(id),
    pricing: { input: p.tcdmxInput * p.tier * p.markup, output: p.tcdmxOutput * p.tier * p.markup },
  }));
}

export async function fetchTcdmxUsage(): Promise<unknown> {
  const { decryptSecret } = await import("@/lib/crypto");
  const activeKey = await prisma.tcdmxKey.findFirst({ where: { status: "active", provider: "tcdmx" }, orderBy: { createdAt: "asc" } });
  if (!activeKey) throw new Error("No active TCDMX key");
  let plain = activeKey.key;
  try { plain = decryptSecret(activeKey.key); } catch { /* raw fallback */ }
  const res = await fetch("https://tcdmx.com/v1/usage", {
    headers: { Authorization: `Bearer ${plain}` },
  });
  if (!res.ok) throw new Error(`TCDMX /v1/usage ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

function getProvider(model: string): string {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gemini")) return "google";
  if (model.startsWith("deepseek")) return "deepseek";
  return "tcdmx";
}
