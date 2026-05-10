import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const redeemCode = await prisma.redeemCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!redeemCode) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 400 });
  if (redeemCode.amount <= 0) return NextResponse.json({ error: "Mã không có giá trị" }, { status: 400 });
  if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
    return NextResponse.json({ error: "Mã đã hết hạn" }, { status: 400 });
  }

  // Rate limit: 1 redeem code per user per 24h. The 2nd code does NOT stack.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRedeem = await prisma.redeemCode.findFirst({
    where: { usedBy: session.user.id, usedAt: { gte: since24h } },
    select: { usedAt: true },
  });
  if (recentRedeem?.usedAt) {
    const nextAt = new Date(recentRedeem.usedAt.getTime() + 24 * 60 * 60 * 1000);
    const hoursLeft = Math.ceil((nextAt.getTime() - Date.now()) / (60 * 60 * 1000));
    return NextResponse.json({
      error: `Mỗi tài khoản chỉ được đổi 1 mã trong 24 giờ. Thử lại sau ${hoursLeft} giờ (vào lúc ${nextAt.toLocaleString("vi-VN")}).`,
    }, { status: 429 });
  }

  // Atomic claim: only succeeds if usedBy is still null — prevents double-redeem race condition
  const claimed = await prisma.redeemCode.updateMany({
    where: { id: redeemCode.id, usedBy: null },
    data: { usedBy: session.user.id, usedAt: new Date() },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ error: "This code has already been used" }, { status: 400 });
  }

  // Per-code creditDays takes precedence; fall back to global Setting "redeem_default_days" (default 30).
  let days: number;
  if (redeemCode.creditDays && redeemCode.creditDays > 0) {
    days = redeemCode.creditDays;
  } else {
    const setting = await prisma.setting.findUnique({ where: { key: "redeem_default_days" } });
    const defaultDays = setting ? parseInt(setting.value, 10) : 30;
    days = Number.isFinite(defaultDays) && defaultDays > 0 ? defaultDays : 30;
  }

  // If user already has redeemBalance with a future expiry, extend by adding days from now;
  // otherwise reset expiry to now + days. We refresh expiry on every new redeem to keep it simple.
  const now = new Date();
  const newExpiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // If existing expiry already passed, also wipe the old balance
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { redeemBalance: true, redeemExpiresAt: true } });
  const expired = user?.redeemExpiresAt && user.redeemExpiresAt < now;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        redeemBalance: expired ? redeemCode.amount : { increment: redeemCode.amount },
        redeemExpiresAt: newExpiry,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        amount: redeemCode.amount,
        type: "redeem",
        method: "redeem_code",
        status: "completed",
        note: `Redeem code: ${redeemCode.code} (expires ${newExpiry.toISOString().slice(0, 10)})`,
        expiresAt: newExpiry,
      },
    }),
  ]);

  return NextResponse.json({ success: true, amount: redeemCode.amount, expiresAt: newExpiry });
}
