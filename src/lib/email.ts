import nodemailer from "nodemailer";

const enabled =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

const transporter = enabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    })
  : null;

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@aigateway.local";
const SITE = process.env.NEXTAUTH_URL || "http://localhost:3001";

async function send(to: string, subject: string, html: string) {
  if (!transporter) {
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", event: "email_disabled", to, subject, hint: "SMTP env not configured; email skipped" }));
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "email_send_failed", to, subject, err: String(err) }));
  }
}

export function isEmailEnabled(): boolean {
  return !!transporter;
}

export async function sendVerifyCode(email: string, code: string) {
  await send(
    email,
    "Mã xác thực đăng ký AI Gateway",
    `<p>Mã xác thực đăng ký tài khoản của bạn:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:4px;font-family:monospace">${code}</p>
     <p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>`
  );
}

export async function sendResetCode(email: string, code: string) {
  await send(
    email,
    "Mã đặt lại mật khẩu AI Gateway",
    `<p>Mã đặt lại mật khẩu của bạn:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:4px;font-family:monospace">${code}</p>
     <p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>`
  );
}

export async function sendWelcome(email: string, name: string) {
  await send(
    email,
    "Chào mừng bạn đến với AI Gateway",
    `<p>Xin chào <b>${name}</b>,</p>
     <p>Tài khoản của bạn đã được tạo thành công tại <a href="${SITE}">${SITE}</a>.</p>
     <p>Đăng nhập và tạo API key đầu tiên để bắt đầu sử dụng.</p>`
  );
}

export async function sendTopupApproved(email: string, amount: number, balance: number) {
  await send(
    email,
    "Nạp tiền thành công",
    `<p>Giao dịch nạp tiền của bạn đã được xác nhận.</p>
     <ul>
       <li>Số tiền nạp: <b>${amount.toFixed(2)} credit</b></li>
       <li>Số dư hiện tại: <b>${balance.toFixed(2)} credit</b></li>
     </ul>
     <p><a href="${SITE}/dashboard/billing">Xem lịch sử giao dịch</a></p>`
  );
}

export async function sendPlanActivated(email: string, planName: string, expiresAt: Date) {
  await send(
    email,
    `Gói ${planName} đã được kích hoạt`,
    `<p>Gói dịch vụ <b>${planName}</b> của bạn đã được kích hoạt.</p>
     <p>Hết hạn: <b>${expiresAt.toLocaleDateString("vi-VN")}</b></p>
     <p><a href="${SITE}/dashboard/billing">Xem chi tiết gói</a></p>`
  );
}

export async function sendLowBalance(email: string, balance: number) {
  await send(
    email,
    "Cảnh báo: Số dư sắp hết",
    `<p>Số dư API của bạn còn <b>${balance.toFixed(2)} credit</b>.</p>
     <p>Vui lòng nạp thêm để tránh gián đoạn dịch vụ.</p>
     <p><a href="${SITE}/dashboard/billing">Nạp tiền ngay</a></p>`
  );
}
