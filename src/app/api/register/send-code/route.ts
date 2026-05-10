import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueCode } from "@/lib/otp";
import { sendVerifyCode, isEmailEnabled } from "@/lib/email";

const attempts: Record<string, { count: number; resetAt: number }> = {};
const RATE_LIMIT = 5;
const RATE_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts[ip];
  if (!entry || entry.resetAt < now) {
    attempts[ip] = { count: 1, resetAt: now + RATE_WINDOW };
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
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút." }, { status: 429 });
  }

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email đã được đăng ký" }, { status: 409 });
    }

    const { code, cooldown } = await issueCode(email, "register");
    if (cooldown) {
      return NextResponse.json({ error: `Vui lòng đợi ${cooldown}s trước khi gửi lại` }, { status: 429 });
    }

    await sendVerifyCode(email, code);

    return NextResponse.json({
      success: true,
      ...(isEmailEnabled() ? {} : { devCode: code }),
    });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
