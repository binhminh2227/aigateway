import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

export type OtpPurpose = "register" | "reset";

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueCode(email: string, purpose: OtpPurpose): Promise<{ code: string; cooldown?: number }> {
  const recent = await prisma.verificationCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const since = Date.now() - recent.createdAt.getTime();
    if (since < OTP_RESEND_COOLDOWN_MS) {
      return { code: "", cooldown: Math.ceil((OTP_RESEND_COOLDOWN_MS - since) / 1000) };
    }
  }

  await prisma.verificationCode.deleteMany({ where: { email, purpose } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  await prisma.verificationCode.create({
    data: {
      email,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  return { code };
}

export async function verifyCode(email: string, purpose: OtpPurpose, code: string): Promise<{ ok: boolean; error?: string }> {
  const record = await prisma.verificationCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "Mã không tồn tại hoặc đã hết hạn" };

  if (record.expiresAt < new Date()) {
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return { ok: false, error: "Mã đã hết hạn" };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return { ok: false, error: "Đã thử quá nhiều lần. Vui lòng yêu cầu mã mới" };
  }

  const match = await bcrypt.compare(code, record.codeHash);
  if (!match) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Mã không đúng" };
  }

  await prisma.verificationCode.delete({ where: { id: record.id } });
  return { ok: true };
}
