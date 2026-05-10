import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  const provided = m[1].trim();
  const row = await prisma.setting.findUnique({ where: { key: "admin_api_token" } });
  if (!row || !row.value) return NextResponse.json({ error: "Admin API not enabled" }, { status: 401 });
  const a = Buffer.from(provided);
  const b = Buffer.from(row.value);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauth = await authorize(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number (USD)" }, { status: 400 });
  }
  const count = Math.max(1, Math.min(parseInt(body.count ?? "1"), 100));
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (!isNaN(d.getTime())) expiresAt = d;
  } else if (body.expireDays) {
    const days = parseInt(body.expireDays);
    if (!isNaN(days) && days > 0) expiresAt = new Date(Date.now() + days * 86400_000);
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;

  let creditDays: number | null = null;
  if (body.creditDays != null) {
    const cd = parseInt(body.creditDays);
    if (!isNaN(cd) && cd > 0) creditDays = cd;
  }

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(10).toString("hex").toUpperCase();
    const row = await prisma.redeemCode.create({
      data: { code, amount, note, createdBy: "api", expiresAt, creditDays },
    });
    codes.push({ id: row.id, code: row.code, amount: row.amount, note: row.note, expiresAt: row.expiresAt, creditDays: row.creditDays });
  }
  return NextResponse.json({ codes }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const unauth = await authorize(req);
  if (unauth) return unauth;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const unusedOnly = searchParams.get("unused") === "1";
  const codes = await prisma.redeemCode.findMany({
    where: unusedOnly ? { usedBy: null } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, code: true, amount: true, note: true, usedBy: true, usedAt: true, expiresAt: true, creditDays: true, createdAt: true },
  });
  return NextResponse.json({ codes });
}
