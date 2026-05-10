import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function fetchWeb2mHistory(token: string, password: string, account: string, bank: string): Promise<{
  id: string; amount: number; content: string; when: string;
}[]> {
  // Web2M URL spec: /historyapi{mb|acb}/{password}/{account}/{token}
  const bankPath = bank === "acb" ? "acb" : "mb";
  const url = `https://api.web2m.com/historyapi${bankPath}/${encodeURIComponent(password)}/${encodeURIComponent(account)}/${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Web2M API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data && data.success === false) throw new Error(`Web2M: ${data.message || data.msg || "request failed"}`);
  if (data && data.status === false) throw new Error(`Web2M: ${data.msg || data.message || "request failed"}`);
  const list = Array.isArray(data) ? data : (data.data || data.transactions || []);
  if (!Array.isArray(list)) throw new Error(`Web2M unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  return list.map((tx: Record<string, unknown>) => ({
    id: String(tx.refNo || tx.id || tx.transactionId || tx.referenceNumber || ""),
    amount: Math.abs(Number(tx.creditAmount || tx.amount || 0)),
    content: String(tx.description || tx.content || ""),
    when: String(tx.transactionDate || tx.postingDate || tx.when || ""),
  }));
}

async function completeTx(txId: string, userId: string, amount: number, planId: string | null, note: string, excessUsd: number = 0) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.transaction.updateMany({
      where: { id: txId, status: "pending" },
      data: { status: "completed", note },
    });
    if (result.count === 0) return;
    if (planId) {
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (plan) {
        const planExpiresAt = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);
        await tx.user.update({
          where: { id: userId },
          data: {
            dailyLimit: plan.dailyLimit,
            planExpiresAt,
            currentPlanId: plan.id,
            ...(excessUsd > 0 ? { balance: { increment: excessUsd } } : {}),
          },
        });
        return;
      }
    }
    await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount + excessUsd } } });
  });
}

export async function runWeb2mPoll(): Promise<{ matched: number; checked: number; message: string }> {
  const cfg = await getSettings([
    "web2m_enabled", "web2m_active_bank",
    "web2m_mb_token", "web2m_mb_password", "web2m_mb_account",
    "web2m_acb_token", "web2m_acb_password", "web2m_acb_account",
    "usd_to_vnd",
  ]);
  if (cfg.web2m_enabled !== "1") return { matched: 0, checked: 0, message: "Web2M polling tắt" };

  const bank = cfg.web2m_active_bank || "mb";
  const token = bank === "acb" ? cfg.web2m_acb_token : cfg.web2m_mb_token;
  const password = bank === "acb" ? cfg.web2m_acb_password : cfg.web2m_mb_password;
  const account = bank === "acb" ? cfg.web2m_acb_account : cfg.web2m_mb_account;
  if (!token || !account) return { matched: 0, checked: 0, message: "Chưa cấu hình token / số tài khoản" };

  const usdToVnd = parseFloat(cfg.usd_to_vnd || "25000") || 25000;
  const now = new Date();

  const history = await fetchWeb2mHistory(token, password || "", account, bank);

  const usedEntryIds = new Set<string>();
  if (history.some(h => h.id)) {
    const completed = await prisma.transaction.findMany({
      where: { status: "completed", note: { contains: "web2m#" } },
      select: { note: true },
    });
    for (const tx of completed) {
      const m = tx.note?.match(/web2m#([^\s|]+)/);
      if (m) usedEntryIds.add(m[1]);
    }
  }

  let matched = 0;
  for (const h of history) {
    if (h.id && usedEntryIds.has(h.id)) continue;
    const contentUpper = h.content.toUpperCase();
    const codeMatch = contentUpper.match(/AIGW[A-Z0-9]{6}/);
    if (codeMatch) {
      const payCode = codeMatch[0];
      const tx = await prisma.transaction.findFirst({ where: { payCode, status: "pending" } });
      if (tx && (tx.expiresAt === null || tx.expiresAt > now)) {
        const expectedVnd = tx.type === "topup" ? Math.round(tx.amount * usdToVnd) : Math.round(tx.amount);
        if (h.amount < expectedVnd) {
          logger.info("web2m_poll_underpaid", { payCode, txId: tx.id, expected: expectedVnd, paid: h.amount });
          continue;
        }
        const excessVnd = h.amount - expectedVnd;
        const excessUsd = excessVnd > 0 ? excessVnd / usdToVnd : 0;
        await completeTx(tx.id, tx.userId, tx.amount, tx.planId ?? null, `${payCode} | web2m#${h.id || h.content.slice(0, 20)}${excessVnd > 0 ? ` | excess +${excessVnd}đ` : ""}`, excessUsd);
        if (h.id) usedEntryIds.add(h.id);
        matched++;
        logger.info("web2m_poll_matched", { payCode, txId: tx.id, entryId: h.id, excessVnd });
      }
    }
  }
  return { matched, checked: history.length, message: matched > 0 ? `✓ Cộng ${matched} giao dịch` : "Không có giao dịch mới" };
}
