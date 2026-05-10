import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function uniquePayCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    let code = "GOI";
    for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
    const exists = await prisma.transaction.findFirst({ where: { payCode: code } });
    if (!exists) return code;
  }
  return "GOI" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, method } = await req.json();
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "Missing planId" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.enabled) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  await prisma.transaction.updateMany({
    where: { userId: session.user.id, status: "pending", type: "subscribe" },
    data: { status: "expired" },
  });

  const payCode = await uniquePayCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      amount: plan.price,
      type: "subscribe",
      method: method || "bank",
      status: "pending",
      note: `Gói: ${plan.name}`,
      payCode,
      planId: plan.id,   // stored in dedicated field — no more string parsing
      expiresAt,
    },
  });

  return NextResponse.json({ ...tx, planName: plan.name, paid: false }, { status: 201 });
}
