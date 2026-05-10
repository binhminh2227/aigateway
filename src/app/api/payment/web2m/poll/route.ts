import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function fetchWeb2mHistory(token: string, password: string, account: string, bank: string): Promise<{
  id: string; amount: number; content: string; when: string;
}[]> {
  const bankPath = bank === "acb" ? "acb" : "mb";
  const res = await fetch(`https://api.web2m.com/historyapi${bankPath}/v2/${account}/0`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Password": password,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Web2M API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const list = data.transactions || data.data || data || [];
  return list.map((tx: Record<string, unknown>) => ({
    id: String(tx.id || tx.transactionId || tx.referenceNumber || ""),
    amount: Math.abs(Number(tx.amount || tx.creditAmount || 0)),
    content: String(tx.description || tx.content || tx.transactionContent || ""),
    when: String(tx.transactionDate || tx.when || tx.createdAt || ""),
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const cronSecret = req.headers.get("x-cron-secret");
  const isAdmin = session?.user?.role === "admin";
  const isCron = cronSecret === process.env.CRON_SECRET;

  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getSettings([
    "web2m_enabled", "web2m_active_bank",
    "web2m_mb_token", "web2m_mb_password", "web2m_mb_account",
    "web2m_acb_token", "web2m_acb_password", "web2m_acb_account",
    "usd_to_vnd",
  ]);

  if (cfg.web2m_enabled !== "1") {
    return NextResponse.json({ message: "Web2M polling tắt" });
  }

  const bank = cfg.web2m_active_bank || "mb";
  const token = bank === "acb" ? cfg.web2m_acb_token : cfg.web2m_mb_token;
  const password = bank === "acb" ? cfg.web2m_acb_password : cfg.web2m_mb_password;
  const account = bank === "acb" ? cfg.web2m_acb_account : cfg.web2m_mb_account;

  if (!token || !account) {
    return NextResponse.json({ message: "Chưa cấu hình token / số tài khoản Web2M" });
  }

  const usdToVnd = parseFloat(cfg.usd_to_vnd || "25000") || 25000;
  const now = new Date();

  let history: { id: string; amount: number; content: string; when: string }[];
  try {
    history = await fetchWeb2mHistory(token, password, account, bank);
  } catch (err) {
    return NextResponse.json({ message: `Lỗi kết nối Web2M: ${(err as Error).message}` }, { status: 502 });
  }

  // Build set of web2m entry IDs already used in completed transactions (idempotency guard)
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
    // Skip already-processed entries (idempotency)
    if (h.id && usedEntryIds.has(h.id)) continue;

    const contentUpper = h.content.toUpperCase();

    // PRIMARY match: payCode (NAP/GOI/UPG + 6 alphanumeric chars) in description
    const codeMatch = contentUpper.match(/(?:NAP|GOI|UPG)[A-Z0-9]{6}/);
    if (codeMatch) {
      const payCode = codeMatch[0];
      const tx = await prisma.transaction.findFirst({
        where: { payCode, status: "pending" },
      });

      if (tx && (tx.expiresAt === null || tx.expiresAt > now)) {
        const expectedVnd = tx.type === "topup" ? Math.round(tx.amount * usdToVnd) : Math.round(tx.amount);
        if (h.amount < expectedVnd) {
          // Underpayment — leave pending, do not credit
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
      continue;
    }

    // STRICT fallback: exact VND amount (no tolerance) + payCode in note
    // Only triggers if transactions were created without payCode (legacy)
    const pending = await prisma.transaction.findMany({
      where: { status: "pending", payCode: null, method: { in: ["bank", "web2m"] } },
      include: { user: { select: { email: true } } },
    });

    const match = pending.find(p => {
      if (p.expiresAt && p.expiresAt < now) return false;
      const expectedVnd = Math.round(p.amount * usdToVnd);
      // Exact amount match only (no tolerance for legacy fallback)
      if (h.amount !== expectedVnd) return false;
      // Require note to be in content
      return p.note ? contentUpper.includes(p.note.toUpperCase()) : false;
    });

    if (match) {
      await completeTx(match.id, match.userId, match.amount, match.planId ?? null, `web2m#${h.id || h.content.slice(0, 20)}`);
      if (h.id) usedEntryIds.add(h.id);
      matched++;
    }
  }

  return NextResponse.json({
    message: matched > 0 ? `✓ Đối soát xong — cộng ${matched} giao dịch` : "Không có giao dịch mới khớp",
    matched,
    checked: history.length,
  });
}

async function completeTx(txId: string, userId: string, amount: number, planId: string | null, note: string, excessUsd: number = 0) {
  await prisma.$transaction(async (tx) => {
    // Atomic claim: only proceeds if status is still "pending" (prevents double-credit)
    const result = await tx.transaction.updateMany({
      where: { id: txId, status: "pending" },
      data: { status: "completed", note },
    });
    if (result.count === 0) return; // already processed by another concurrent request

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
