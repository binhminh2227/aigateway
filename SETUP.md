# AI Gateway - Hướng Dẫn Cài Đặt

## Cấu Trúc Project
```
aigateway/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── login/                # Đăng nhập
│   │   ├── register/             # Đăng ký
│   │   ├── dashboard/            # User dashboard
│   │   │   ├── page.tsx          # Overview
│   │   │   ├── api-keys/         # Quản lý API keys
│   │   │   ├── billing/          # Nạp tiền
│   │   │   └── usage/            # Thống kê sử dụng
│   │   ├── admin/                # Admin panel
│   │   └── api/
│   │       ├── v1/chat/completions/  # ← Proxy đến tcdmx.com
│   │       ├── v1/models/            # Danh sách models
│   │       ├── keys/                 # API key management
│   │       ├── billing/              # Billing API
│   │       └── admin/                # Admin API
│   └── lib/
│       ├── db.ts                 # Prisma client
│       ├── auth.ts               # NextAuth config
│       └── proxy.ts              # Proxy logic + pricing
├── prisma/schema.prisma          # Database schema
└── scripts/seed.js               # Seed admin account
```

## Cài Đặt

### 1. Clone và cài dependencies
```bash
cd aigateway
npm install
```

### 2. Cấu hình .env
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="random-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# API key tcdmx.com của bạn
TCDMX_API_KEY="sk-your-tcdmx-api-key"
TCDMX_BASE_URL="https://tcdmx.com"

# Admin account — REQUIRED. Use a strong password (≥16 chars, mixed case + symbols).
# Never commit your real .env. Default/weak passwords like "admin123456" are unsafe in production.
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="your-admin-password"

# Thông tin ngân hàng
BANK_NAME="Vietcombank"
BANK_ACCOUNT="1234567890"
BANK_HOLDER="NGUYEN VAN A"

# USDT wallets
USDT_WALLET_TRC20="your-trc20-address"
USDT_WALLET_ERC20="your-erc20-address"

# Markup so với giá tcdmx (1.3 = 30%)
PRICE_MARKUP="1.3"
```

### 3. Tạo database và seed admin
```bash
npm run db:push    # Tạo tables
npm run db:seed    # Tạo admin account
```

### 4. Chạy development server
```bash
npm run dev
# → http://localhost:3000
```

## Tài Khoản Admin Mặc Định
- Email: `admin@gateway.com`
- Password: `admin123456`
- Đổi ngay trong .env trước khi deploy!

## Luồng Hoạt Động

```
User Request (API key: sk-gw-xxxx)
     ↓
Validate API key → Check balance
     ↓
Forward to tcdmx.com (TCDMX_API_KEY)
     ↓
Track usage → Deduct balance
     ↓
Return response to User
```

## API Endpoints

### Cho Users (dùng API key)
```
POST /v1/chat/completions    # Chat (OpenAI compatible)
GET  /v1/models              # Danh sách models
```

### User Management
```
POST /api/register           # Đăng ký
GET  /api/keys               # Danh sách API keys
POST /api/keys               # Tạo API key
DELETE /api/keys             # Xóa API key
GET  /api/billing            # Xem balance + transactions
POST /api/billing            # Gửi yêu cầu nạp tiền
```

### Admin
```
GET  /api/admin?type=stats       # Thống kê tổng quan
GET  /api/admin?type=users       # Danh sách users
GET  /api/admin?type=transactions # Lịch sử giao dịch
POST /api/admin (action: approve_topup)  # Duyệt nạp tiền
POST /api/admin (action: add_balance)    # Thêm balance thủ công
```

## Ví Dụ Sử Dụng API

### Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-domain.com/v1",
    api_key="sk-gw-your-api-key"
)

response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",  # hoặc gpt-4o, gemini-1.5-pro
    messages=[{"role": "user", "content": "Xin chào!"}]
)
```

### JavaScript
```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://your-domain.com/v1",
  apiKey: "sk-gw-your-api-key",
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Deploy Production

### Vercel
```bash
vercel deploy
# Set environment variables in Vercel dashboard
```

### VPS với PM2
```bash
npm run build
pm2 start npm --name "aigateway" -- start
```

## Lưu Ý Quan Trọng
1. Đổi `NEXTAUTH_SECRET` thành chuỗi random dài
2. Cập nhật `TCDMX_API_KEY` với key thực của bạn
3. Cấu hình thông tin ngân hàng và USDT chính xác
4. Điều chỉnh `PRICE_MARKUP` theo mức lợi nhuận mong muốn
5. Không commit file `.env` lên git
