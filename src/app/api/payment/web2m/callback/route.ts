import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value || "";
}

async function completeTransaction(
  txId: string,
  userId: string,
  amount: number,
  note: string,
  planId: string | null,
  excessUsd: number = 0
) {
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

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const storedToken = await getSetting("web2m_access_token");
  const enabled = await getSetting("web2m_enabled");

  if (enabled !== "1") {
    return NextResponse.json({ status: false, msg: "Webhook disabled" }, { status: 503 });
  }

  if (!storedToken || bearerToken !== storedToken) {
    return NextResponse.json({ status: false, msg: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.data || !Array.isArray(body.data)) {
    return NextResponse.json({ status: true, msg: "Ok" });
  }

  const usdToVnd = parseFloat(await getSetting("usd_to_vnd") || "25000") || 25000;
  const now = new Date();

  const incoming = body.data.filter((tx: { type: string }) => tx.type === "IN");

  for (const wTx of incoming) {
    const wAmount = parseInt(String(wTx.amount).replace(/\D/g, ""), 10);
    const wDesc = String(wTx.description || "").toUpperCase();

    // Primary match: payCode (NAP/GOI/UPG + 6 chars) in description
    const codeMatch = wDesc.match(/(?:NAP|GOI|UPG)[A-Z0-9]{6}/);
    if (codeMatch) {
      const payCode = codeMatch[0];
      const tx = await prisma.transaction.findFirst({
        where: { payCode, status: "pending" },
      });
      if (tx && (tx.expiresAt === null || tx.expiresAt > now)) {
        // Compute expected VND for this tx (topup is USD, subscribe/upgrade is VND already)
        const expectedVnd = tx.type === "topup" ? Math.round(tx.amount * usdToVnd) : Math.round(tx.amount);
        if (wAmount < expectedVnd) {
          // Underpayment: do NOT credit; leave pending so user contacts admin
          continue;
        }
        const excessVnd = wAmount - expectedVnd;
        const excessUsd = excessVnd > 0 ? excessVnd / usdToVnd : 0;
        await completeTransaction(tx.id, tx.userId, tx.amount, `${payCode} | web2m#${wTx.id}${excessVnd > 0 ? ` | excess +${excessVnd}đ` : ""}`, tx.planId, excessUsd);
        continue;
      }
    }

    // Fallback: legacy transactions without payCode — strict match only
    const pending = await prisma.transaction.findMany({
      where: { status: "pending", payCode: null, method: { in: ["bank", "web2m"] } },
    });

    const wDescLower = wDesc.toLowerCase();
    const match = pending.find(p => {
      if (p.expiresAt && p.expiresAt < now) return false;
      const expectedVnd = Math.round(p.amount * usdToVnd);
      // Exact amount + note must be in description
      return wAmount === expectedVnd && p.note && wDescLower.includes(p.note.toLowerCase());
    });

    if (match) {
      await completeTransaction(match.id, match.userId, match.amount, `web2m#${wTx.id}`, match.planId);
    }
  }

  return NextResponse.json({ status: true, msg: "Ok" });
}

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
