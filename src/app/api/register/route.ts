import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendWelcome } from "@/lib/email";
import { verifyCode } from "@/lib/otp";

// Simple in-memory rate limiter: max 5 register attempts per IP per 15 minutes
const registerAttempts: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT = 5;
const RATE_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registerAttempts[ip];
  if (!entry || entry.resetAt < now) {
    registerAttempts[ip] = { count: 1, resetAt: now + RATE_WINDOW };
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  try {
    const { email, password, name, code } = await req.json();

    if (!email || !password || !code) {
      return NextResponse.json({ error: "Email, mật khẩu và mã xác thực là bắt buộc" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email đã được đăng ký" }, { status: 409 });
    }

    const verified = await verifyCode(email, "register", String(code));
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error || "Mã xác thực không hợp lệ" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const displayName = name || email.split("@")[0];
    const user = await prisma.user.create({
      data: { email, password: hashed, name: displayName },
    });

    sendWelcome(email, displayName).catch(() => null);
    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
