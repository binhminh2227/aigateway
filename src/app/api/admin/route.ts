import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { sendTopupApproved, sendPlanActivated } from "@/lib/email";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session || (session as { user?: { role?: string } }).user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const skip = (page - 1) * limit;

  if (type === "users") {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true, email: true, name: true, balance: true, redeemBalance: true, redeemExpiresAt: true, role: true,
          banned: true, dailyLimit: true, planExpiresAt: true, createdAt: true,
          _count: { select: { apiKeys: true, usageLogs: true } },
        },
      }),
      prisma.user.count(),
    ]);
    return NextResponse.json({ users, total, page, limit });
  }

  if (type === "analytics") {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
      const next = new Date(d); next.setDate(next.getDate() + 1);
      return { d, next, label: d.toISOString().slice(0, 10) };
    });

    const [
      totalTopup, totalPlan, totalBalance,
      totalUsers, bannedUsers,
      topModelsRaw,
      ...weekRows
    ] = await Promise.all([
      prisma.transaction.aggregate({ where: { status: "completed", type: "topup" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { status: "completed", type: "subscribe" }, _sum: { amount: true } }),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { banned: true } }),
      // groupBy without orderBy aggregate — sort in JS to avoid SQLite compatibility issues
      prisma.usageLog.groupBy({ by: ["model"], _sum: { cost: true } }),
      ...days.map(({ d, next }) =>
        prisma.usageLog.aggregate({
          where: { createdAt: { gte: d, lt: next } },
          _sum: { cost: true },
          _count: { _all: true },
        })
      ),
    ]);

    const topModels = [...topModelsRaw]
      .sort((a, b) => (b._sum.cost || 0) - (a._sum.cost || 0))
      .slice(0, 5)
      .map(m => ({ model: m.model, cost: m._sum.cost || 0 }));

    const weekRevenue = days.map(({ label }, i) => ({
      date: label,
      revenue: weekRows[i]._sum.cost || 0,
      requests: weekRows[i]._count._all || 0,
    }));

    return NextResponse.json({
      totalTopup: totalTopup._sum.amount || 0,
      totalPlan: totalPlan._sum.amount || 0,
      totalBalance: totalBalance._sum.balance || 0,
      totalUsers, bannedUsers, topModels, weekRevenue,
    });
  }

  if (type === "transactions") {
    const statusFilter = searchParams.get("status");
    const where = statusFilter ? { status: statusFilter } : {};
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);
    return NextResponse.json({ transactions, total, page, limit });
  }

  if (type === "stats") {
    const [users, keys, totalUsage, pendingTx, todayUsage] = await Promise.all([
      prisma.user.count(),
      prisma.apiKey.count({ where: { status: "active" } }),
      prisma.usageLog.aggregate({ _sum: { cost: true } }),
      prisma.transaction.count({ where: { status: "pending" } }),
      prisma.usageLog.aggregate({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { cost: true },
        _count: { _all: true },
      }),
    ]);
    return NextResponse.json({
      totalUsers: users,
      activeKeys: keys,
      totalRevenue: totalUsage._sum.cost || 0,
      pendingTopups: pendingTx,
      todayRevenue: todayUsage._sum.cost || 0,
      todayRequests: todayUsage._count._all || 0,
    });
  }

  if (type === "redeem_codes") {
    const codes = await prisma.redeemCode.findMany({ orderBy: { createdAt: "desc" }, take: limit, skip });
    return NextResponse.json(codes);
  }

  if (type === "tcdmx_keys") {
    const keys = await prisma.tcdmxKey.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(keys.map(k => ({ ...k, key: k.keyPrefix || "***" })));
  }

  if (type === "tcdmx_reconcile") {
    const { decryptSecret } = await import("@/lib/crypto");
    const activeKey = await prisma.tcdmxKey.findFirst({ where: { status: "active", provider: "tcdmx" }, orderBy: { createdAt: "asc" } });
    if (!activeKey) return NextResponse.json({ error: "No active TCDMX key" }, { status: 400 });
    let plain = activeKey.key;
    try { plain = decryptSecret(activeKey.key); } catch { /* fallback to raw */ }
    let usage: { quota?: { used: number; remaining: number; limit: number; unit: string }; model_stats?: Array<{ model: string; cost: number; actual_cost: number; requests: number }> } | null = null;
    try {
      const r = await fetch("https://tcdmx.com/v1/usage", { headers: { Authorization: `Bearer ${plain}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) return NextResponse.json({ error: `TCDMX returned ${r.status}` }, { status: 502 });
      usage = await r.json();
    } catch (e) {
      const msg = (e as Error)?.name === "TimeoutError" ? "TCDMX timeout (>15s)" : `Fetch failed: ${String(e)}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    // Compute mình thu vs TCDMX trừ — all-time
    const totals = await prisma.usageLog.aggregate({ _sum: { cost: true, tcdmxCost: true } });
    const myRevenue = totals._sum.cost || 0;
    const myComputedTcdmxCost = totals._sum.tcdmxCost || 0;
    const realTcdmxUsed = usage?.quota?.used || 0;
    const drift = myComputedTcdmxCost > 0 ? (myComputedTcdmxCost - realTcdmxUsed) / realTcdmxUsed : 0;
    const profit = myRevenue - realTcdmxUsed;
    return NextResponse.json({
      quota: usage?.quota,
      model_stats: usage?.model_stats,
      myRevenue,
      myComputedTcdmxCost,
      realTcdmxUsed,
      drift,
      profit,
      profitMargin: myRevenue > 0 ? profit / myRevenue : 0,
    });
  }

  if (type === "model_pricing") {
    const rows = await prisma.modelPricing.findMany({ orderBy: { model: "asc" } });
    return NextResponse.json(rows);
  }

  if (type === "pricing_audit") {
    const { fetchTcdmxUsage } = await import("@/lib/proxy");
    let usage: any;
    try { usage = await fetchTcdmxUsage(); }
    catch (e) { return NextResponse.json({ error: String(e) }, { status: 502 }); }
    const items: any[] = Array.isArray(usage) ? usage : (usage?.model_stats || usage?.data || usage?.usage || usage?.models || []);
    const rows = await prisma.modelPricing.findMany();
    const dbByModel = new Map(rows.map(r => [r.model, r]));
    const audit: any[] = [];
    for (const it of items) {
      const model = it.model || it.name || it.id;
      if (!model) continue;
      const cost = Number(it.actual_cost ?? it.cost ?? it.account_cost ?? 0);
      const inTok = Number(it.input_tokens ?? it.prompt_tokens ?? 0);
      const outTok = Number(it.output_tokens ?? it.completion_tokens ?? 0);
      const cachedTok = Number(it.cache_read_tokens ?? it.cached_tokens ?? 0);
      const totalTok = inTok + outTok;
      if (cost <= 0 || totalTok <= 0) continue;
      const actualPerM = cost / totalTok * 1_000_000;
      const db = dbByModel.get(model);
      let dbBlendedPerM: number | null = null;
      let divergencePct: number | null = null;
      if (db) {
        const tier = db.tcdmxTier || 1.0;
        const inRate = (db.tcdmxInputPrice || 0) * tier;
        const outRate = (db.tcdmxOutputPrice || 0) * tier;
        const cacheRate = (db.tcdmxCachePrice > 0 ? db.tcdmxCachePrice : (db.tcdmxInputPrice || 0) * 0.1) * tier;
        const billableIn = Math.max(0, inTok - cachedTok);
        const expectedCost = (billableIn * inRate + cachedTok * cacheRate + outTok * outRate) / 1_000_000;
        dbBlendedPerM = expectedCost / totalTok * 1_000_000;
        if (expectedCost > 0) divergencePct = (actualPerM - dbBlendedPerM) / dbBlendedPerM * 100;
      }
      audit.push({
        model,
        inputTokens: inTok,
        outputTokens: outTok,
        cachedTokens: cachedTok,
        actualCost: cost,
        actualPerMTokens: parseFloat(actualPerM.toFixed(6)),
        dbBlendedPerMTokens: dbBlendedPerM !== null ? parseFloat(dbBlendedPerM.toFixed(6)) : null,
        divergencePct: divergencePct !== null ? parseFloat(divergencePct.toFixed(2)) : null,
        status: divergencePct === null ? "no_db_pricing" : Math.abs(divergencePct) > 10 ? "diverged" : "ok",
      });
    }
    audit.sort((a, b) => Math.abs(b.divergencePct || 0) - Math.abs(a.divergencePct || 0));
    return NextResponse.json({ audit, fetchedAt: new Date().toISOString() });
  }

  if (type === "settings") {
    const rows = await prisma.setting.findMany();
    return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }

  if (type === "plans") {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json(rows);
  }

  if (type === "admin_api_token") {
    const row = await prisma.setting.findUnique({ where: { key: "admin_api_token" } });
    return NextResponse.json({ token: row?.value || null });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireAdmin(session);
  if (err) return err;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { action, ...data } = body;

  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  // Guard: userId must be a non-empty string when present
  if (data.userId !== undefined && (typeof data.userId !== "string" || !data.userId.trim())) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  // Guard: txId must be a non-empty string when present
  if (data.txId !== undefined && (typeof data.txId !== "string" || !data.txId.trim())) {
    return NextResponse.json({ error: "Invalid txId" }, { status: 400 });
  }

  if (action === "approve_topup") {
    const tx = await prisma.transaction.findUnique({ where: { id: data.txId } });
    if (!tx || tx.status !== "pending") {
      return NextResponse.json({ error: "Transaction not found or already processed" }, { status: 400 });
    }

    // Check expiry — admin should not approve expired transactions
    if (tx.expiresAt && tx.expiresAt < new Date()) {
      return NextResponse.json({ error: "Transaction has expired" }, { status: 400 });
    }

    if (tx.type === "subscribe" && tx.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: tx.planId } });
      if (plan) {
        const planExpiresAt = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: tx.id }, data: { status: "completed" } }),
          prisma.user.update({ where: { id: tx.userId }, data: { dailyLimit: plan.dailyLimit, planExpiresAt, currentPlanId: plan.id } }),
        ]);
        const user = await prisma.user.findUnique({ where: { id: tx.userId }, select: { email: true } });
        if (user?.email) sendPlanActivated(user.email, plan.name, planExpiresAt).catch(() => null);
        return NextResponse.json({ success: true });
      }
    }

    // Default: topup — credit balance
    const [, updatedUser] = await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: "completed" } }),
      prisma.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } }, select: { email: true, balance: true } }),
    ]);
    if (updatedUser?.email) sendTopupApproved(updatedUser.email, tx.amount, updatedUser.balance).catch(() => null);
    return NextResponse.json({ success: true });
  }

  if (action === "reject_topup") {
    const tx = await prisma.transaction.findUnique({ where: { id: data.txId } });
    if (!tx || tx.status !== "pending") {
      return NextResponse.json({ error: "Transaction not found or already processed" }, { status: 400 });
    }
    await prisma.transaction.update({ where: { id: data.txId }, data: { status: "failed" } });
    return NextResponse.json({ success: true });
  }

  if (action === "add_balance") {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Invalid amount (must be 0–100000)" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.user.update({ where: { id: data.userId }, data: { balance: { increment: amount } } }),
      prisma.transaction.create({
        data: { userId: data.userId, amount, type: "topup", method: "admin", status: "completed", note: data.note || "Admin manual top-up" },
      }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (action === "set_role") {
    if (!["user", "admin"].includes(data.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: data.userId }, data: { role: data.role } });
    return NextResponse.json({ success: true });
  }

  if (action === "set_daily_limit") {
    const limit = parseFloat(data.limit);
    if (isNaN(limit) || limit < 0) {
      return NextResponse.json({ error: "Invalid daily limit" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: data.userId }, data: { dailyLimit: limit } });
    return NextResponse.json({ success: true });
  }

  if (action === "ban_user") {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "admin") return NextResponse.json({ error: "Cannot ban admin" }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: data.userId }, data: { banned: true } }),
      prisma.apiKey.updateMany({ where: { userId: data.userId }, data: { status: "inactive" } }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (action === "unban_user") {
    await prisma.user.update({ where: { id: data.userId }, data: { banned: false } });
    return NextResponse.json({ success: true });
  }

  if (action === "change_password") {
    if (!data.password || typeof data.password !== "string" || data.password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải ít nhất 6 ký tự" }, { status: 400 });
    }
    const hashed = await (await import("bcryptjs")).hash(data.password, 12);
    await prisma.user.update({ where: { id: data.userId }, data: { password: hashed } });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_user") {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "admin") return NextResponse.json({ error: "Cannot delete admin" }, { status: 400 });
    await prisma.user.delete({ where: { id: data.userId } });
    return NextResponse.json({ success: true });
  }

  if (action === "create_redeem_code") {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const count = Math.max(1, Math.min(parseInt(data.count || "1"), 100));
    // expiresAt: ISO string or days-from-now number
    let expiresAt: Date | null = null;
    if (data.expiresAt) {
      const d = new Date(data.expiresAt);
      if (!isNaN(d.getTime())) expiresAt = d;
    } else if (data.expireDays) {
      const days = parseInt(data.expireDays);
      if (!isNaN(days) && days > 0) expiresAt = new Date(Date.now() + days * 86400_000);
    }
    let creditDays: number | null = null;
    if (data.creditDays != null && data.creditDays !== "") {
      const cd = parseInt(data.creditDays);
      if (!isNaN(cd) && cd > 0) creditDays = cd;
    }
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(10).toString("hex").toUpperCase();
      const redeemCode = await prisma.redeemCode.create({
        data: { code, amount, note: data.note, createdBy: session!.user.id, expiresAt, creditDays },
      });
      codes.push(redeemCode);
    }
    return NextResponse.json(codes, { status: 201 });
  }

  if (action === "delete_redeem_code") {
    await prisma.redeemCode.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  }

  if (action === "generate_admin_api_token") {
    const token = "agw-adm-" + crypto.randomBytes(24).toString("hex");
    await prisma.setting.upsert({
      where: { key: "admin_api_token" },
      update: { value: token },
      create: { key: "admin_api_token", value: token },
    });
    return NextResponse.json({ token });
  }

  if (action === "revoke_admin_api_token") {
    await prisma.setting.deleteMany({ where: { key: "admin_api_token" } });
    return NextResponse.json({ success: true });
  }

  if (action === "cleanup_expired_codes") {
    const result = await prisma.redeemCode.deleteMany({
      where: { usedBy: null, expiresAt: { lt: new Date() } },
    });
    return NextResponse.json({ deleted: result.count });
  }

  if (action === "add_tcdmx_key") {
    if (!data.key || data.key.trim().length < 10) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }
    const { encryptSecret, sha256, maskKey } = await import("@/lib/crypto");
    const plain = data.key.trim();
    const provider = (typeof data.provider === "string" && data.provider.trim()) ? data.provider.trim() : "tcdmx";
    const keyHash = sha256(plain);
    const existing = await prisma.tcdmxKey.findUnique({ where: { keyHash } });
    let row;
    if (existing) {
      row = await prisma.tcdmxKey.update({
        where: { id: existing.id },
        data: { status: "active", errorCount: 0, label: data.label || null, provider, keyPrefix: maskKey(plain) },
      });
    } else {
      row = await prisma.tcdmxKey.create({
        data: {
          key: encryptSecret(plain),
          keyHash,
          keyPrefix: maskKey(plain),
          label: data.label || null,
          provider,
        },
      });
    }
    return NextResponse.json({ ...row, key: row.keyPrefix || maskKey(plain) });
  }

  if (action === "toggle_tcdmx_key") {
    const row = await prisma.tcdmxKey.findUnique({ where: { id: data.id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.tcdmxKey.update({
      where: { id: data.id },
      data: { status: row.status === "active" ? "disabled" : "active", errorCount: 0 },
    });
    return NextResponse.json({ ...updated, key: updated.keyPrefix || "***" });
  }

  if (action === "delete_tcdmx_key") {
    await prisma.tcdmxKey.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  }

  if (action === "reset_tcdmx_key_errors") {
    await prisma.tcdmxKey.update({ where: { id: data.id }, data: { errorCount: 0, status: "active" } });
    return NextResponse.json({ success: true });
  }

  if (action === "upsert_model_pricing") {
    const { model, tcdmxInputPrice, tcdmxOutputPrice, tcdmxCachePrice, tcdmxTier, markup, enabled, flatCostPerCall } = data;
    const tIn = parseFloat(tcdmxInputPrice);
    const tOut = parseFloat(tcdmxOutputPrice);
    const tCache = parseFloat(tcdmxCachePrice ?? "0") || 0;
    const tier = parseFloat(tcdmxTier ?? "2.0");
    const mk = parseFloat(markup ?? "1.3");
    const flatRaw = flatCostPerCall === "" || flatCostPerCall == null ? null : parseFloat(flatCostPerCall);
    const flat = flatRaw != null && !isNaN(flatRaw) && flatRaw > 0 ? flatRaw : null;
    if (!model || isNaN(tIn) || isNaN(tOut) || isNaN(tier) || isNaN(mk) || tier <= 0 || mk <= 0) {
      return NextResponse.json({ error: "Invalid pricing data" }, { status: 400 });
    }
    const finalIn = tIn * tier * mk;
    const finalOut = tOut * tier * mk;
    const row = await prisma.modelPricing.upsert({
      where: { model },
      create: { model, tcdmxInputPrice: tIn, tcdmxOutputPrice: tOut, tcdmxCachePrice: tCache, tcdmxTier: tier, markup: mk, flatCostPerCall: flat, inputPrice: finalIn, outputPrice: finalOut, enabled: enabled !== false },
      update: { tcdmxInputPrice: tIn, tcdmxOutputPrice: tOut, tcdmxCachePrice: tCache, tcdmxTier: tier, markup: mk, flatCostPerCall: flat, inputPrice: finalIn, outputPrice: finalOut, enabled: enabled !== false },
    });
    const { invalidatePricingCache } = await import("@/lib/proxy");
    invalidatePricingCache();
    return NextResponse.json(row);
  }

  if (action === "delete_model_pricing") {
    await prisma.modelPricing.delete({ where: { id: data.id } });
    const { invalidatePricingCache } = await import("@/lib/proxy");
    invalidatePricingCache();
    return NextResponse.json({ success: true });
  }

  if (action === "save_settings") {
    const ALLOWED_KEYS = new Set([
      "bank_name", "bank_account", "bank_holder", "bank_content",
      "usdt_trc20", "usdt_erc20", "usdt_rate",
      "web2m_enabled", "web2m_access_token", "web2m_bank_bin", "web2m_vietqr",
      "web2m_active_bank",
      "web2m_mb_token", "web2m_mb_password", "web2m_mb_account",
      "web2m_acb_token", "web2m_acb_password", "web2m_acb_account",
      "usd_to_vnd", "price_markup", "default_concurrency", "bank_manual_enabled",
    ]);
    if (!data.settings || typeof data.settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }
    const entries = Object.entries(data.settings as Record<string, string>);
    const rejected = entries.filter(([k]) => !ALLOWED_KEYS.has(k)).map(([k]) => k);
    if (rejected.length > 0) {
      return NextResponse.json({ error: `Unknown setting keys: ${rejected.join(", ")}` }, { status: 400 });
    }
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value).slice(0, 1000) },
          update: { value: String(value).slice(0, 1000) },
        })
      )
    );
    return NextResponse.json({ success: true });
  }

  if (action === "upsert_plan") {
    const { id, name, price, duration, dailyLimit, concurrencyLimit, description, features, enabled, sortOrder } = data;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Plan name required" }, { status: 400 });
    }
    const parsedPrice = parseFloat(price);
    const parsedDuration = parseInt(duration);
    if (isNaN(parsedPrice) || parsedPrice < 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (isNaN(parsedDuration) || parsedDuration < 1) return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    const planData = {
      name: name.trim().slice(0, 100),
      price: parsedPrice,
      duration: parsedDuration,
      dailyLimit: parseFloat(dailyLimit) || 0,
      concurrencyLimit: Math.max(1, parseInt(concurrencyLimit) || 5),
      description: description ? String(description).slice(0, 500) : null,
      features: Array.isArray(features) ? JSON.stringify(features.map((f: unknown) => String(f).slice(0, 200))) : String(features || "[]"),
      enabled: enabled !== false,
      sortOrder: parseInt(sortOrder) || 0,
    };
    const row = id
      ? await prisma.plan.update({ where: { id }, data: planData })
      : await prisma.plan.create({ data: planData });
    return NextResponse.json(row);
  }

  if (action === "delete_plan") {
    if (!data.id || typeof data.id !== "string") return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await prisma.plan.delete({ where: { id: data.id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
