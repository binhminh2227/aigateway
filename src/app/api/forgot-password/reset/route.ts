import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();
    if (!email || !code || !password) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Email hoặc mã không hợp lệ" }, { status: 400 });
    }

    const verified = await verifyCode(email, "reset", String(code));
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error || "Mã xác thực không hợp lệ" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email }, data: { password: hashed } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
