import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function genPayCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AIGW";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function uniquePayCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = genPayCode();
    const exists = await prisma.transaction.findFirst({ where: { payCode: code } });
    if (!exists) return code;
  }
  // fallback: append timestamp suffix to guarantee uniqueness
  return "AIGW" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "usage") {
    const cursor = searchParams.get("cursor");
    const PAGE_SIZE = 50;
    const logs = await prisma.usageLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = logs.length > PAGE_SIZE;
    const items = hasMore ? logs.slice(0, PAGE_SIZE) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return NextResponse.json({ logs: items, nextCursor });
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true, dailyLimit: true, planExpiresAt: true, currentPlanId: true,
      redeemBalance: true, redeemExpiresAt: true,
    },
  });
  const plan = user?.currentPlanId
    ? await prisma.plan.findUnique({ where: { id: user.currentPlanId }, select: { name: true } })
    : null;

  const since30 = new Date(Date.now() - 30 * 86400_000);
  const recentLogs = await prisma.usageLog.findMany({
    where: { userId: session.user.id, createdAt: { gte: since30 } },
    select: { apiKeyId: true, cost: true, createdAt: true },
  });

  const redeemAgg = await prisma.transaction.aggregate({
    where: { userId: session.user.id, method: "redeem_code", status: "completed" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalRedeemed = redeemAgg._sum.amount || 0;
  const redeemUsed = Math.max(0, totalRedeemed - (user?.redeemBalance || 0));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const planActive = (user?.dailyLimit || 0) > 0 && user?.planExpiresAt && user.planExpiresAt >= new Date();
  const dayAgg = planActive
    ? await prisma.usageLog.aggregate({ where: { userId: session.user.id, createdAt: { gte: today } }, _sum: { cost: true } })
    : null;

  return NextResponse.json({
    transactions,
    balance: user?.balance || 0,
    dailyLimit: user?.dailyLimit || 0,
    planExpiresAt: user?.planExpiresAt || null,
    currentPlanId: user?.currentPlanId || null,
    planName: plan?.name || null,
    planDailyUsed: dayAgg?._sum.cost || 0,
    redeemBalance: user?.redeemBalance || 0,
    redeemExpiresAt: user?.redeemExpiresAt || null,
    redeemTotal: totalRedeemed,
    redeemUsed,
    redeemCount: redeemAgg._count._all,
    usageLogs: recentLogs,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, method, note, proofUrl } = await req.json();

  if (!amount || amount < 1) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Expire any previous pending topups from this user
  await prisma.transaction.updateMany({
    where: { userId: session.user.id, status: "pending", type: "topup" },
    data: { status: "expired" },
  });

  const payCode = await uniquePayCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      amount: parseFloat(amount),
      type: "topup",
      method: method || "bank",
      status: "pending",
      note: note || payCode,
      proofUrl,
      payCode,
      expiresAt,
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
