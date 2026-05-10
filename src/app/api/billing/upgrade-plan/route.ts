import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function uniquePayCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    let code = "UPG";
    for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
    const exists = await prisma.transaction.findFirst({ where: { payCode: code } });
    if (!exists) return code;
  }
  return "UPG" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, method } = await req.json();
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "Missing planId" }, { status: 400 });
  }

  const newPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!newPlan || !newPlan.enabled) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, currentPlanId: true, planExpiresAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const planActive = user.planExpiresAt != null && user.planExpiresAt > now && user.currentPlanId;
  if (!planActive) {
    return NextResponse.json({ error: "Bạn chưa có gói đang dùng. Vui lòng đăng ký gói thường." }, { status: 400 });
  }
  if (user.currentPlanId === newPlan.id) {
    return NextResponse.json({ error: "Bạn đang dùng gói này rồi." }, { status: 400 });
  }

  const curPlan = await prisma.plan.findUnique({ where: { id: user.currentPlanId! } });
  let refundVnd = 0;
  if (curPlan && curPlan.duration > 0) {
    const msLeft = user.planExpiresAt!.getTime() - now.getTime();
    // Whole future days only. Day-of-purchase counts as used → 7d plan just bought = 6 days refundable.
    const daysLeft = Math.max(0, Math.floor(msLeft / (24 * 60 * 60 * 1000)));
    const perDay = Math.round(curPlan.price / curPlan.duration);
    refundVnd = Math.max(0, daysLeft * perDay);
  }

  const netVnd = Math.max(0, Math.round(newPlan.price - refundVnd));

  // Cancel any older pending upgrade/subscribe transactions
  await prisma.transaction.updateMany({
    where: { userId: user.id, status: "pending", type: "subscribe" },
    data: { status: "expired" },
  });

  const payCode = await uniquePayCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: netVnd,
      type: "subscribe",
      method: method || "bank",
      status: "pending",
      note: `Nâng gói: ${curPlan?.name || "?"} → ${newPlan.name} (refund ${refundVnd.toLocaleString("vi-VN")}đ)`,
      payCode,
      planId: newPlan.id,
      expiresAt,
    },
  });

  return NextResponse.json({
    ...tx,
    planName: newPlan.name,
    refundVnd,
    netVnd,
    paid: false,
  }, { status: 201 });
}
