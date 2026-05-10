import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const txId = searchParams.get("id");
  if (!txId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const tx = await prisma.transaction.findFirst({
    where: { id: txId, userId: session.user.id },
    select: { id: true, status: true, expiresAt: true, amount: true, payCode: true },
  });

  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-expire if past deadline
  if (tx.status === "pending" && tx.expiresAt && tx.expiresAt < new Date()) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: "expired" } });
    return NextResponse.json({ ...tx, status: "expired" });
  }

  return NextResponse.json(tx);
}
