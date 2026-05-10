# Deploy AI Gateway lên VPS Linux

## 1. Chuẩn bị VPS

```bash
# Cài Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login lại

# Tường lửa: chỉ mở 22 (SSH), 80, 443
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Đẩy code lên VPS

```bash
# Trên máy local — đẩy lên git riêng
git init && git add . && git commit -m "init"
git remote add origin git@github.com:youruser/aigateway.git
git push -u origin main

# Trên VPS
git clone git@github.com:youruser/aigateway.git
cd aigateway
cp .env.production.example .env
nano .env   # ← điền NEXTAUTH_SECRET, TCDMX_API_KEY, SMTP_*, domain
```

Sinh `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 48
```

## 3. Build + chạy

```bash
docker compose up -d --build

# Seed admin (chỉ chạy lần đầu)
docker compose exec aigateway sh -c \
  'ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD node scripts/seed.js'
```

Kiểm tra:
```bash
docker compose ps
docker compose logs -f aigateway
curl http://localhost:3000/api/health
```

## 4. Reverse proxy + HTTPS (Caddy — đơn giản nhất)

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

Nội dung:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy tự xin Let's Encrypt SSL.

## 5. Backup DB định kỳ

```bash
# Cron hằng đêm
echo '0 3 * * * cd /home/$USER/aigateway && cp data/prod.db data/backup-$(date +\%F).db && find data -name "backup-*.db" -mtime +14 -delete' | crontab -
```

## 6. Update code

```bash
cd ~/aigateway
git pull
docker compose up -d --build
```

## 7. Lưu ý quan trọng

- **Concurrency counter** đang in-memory — đảm bảo chỉ chạy **1 replica** (compose mặc định 1, OK).
- **SQLite** ổn cho < 10k user. Khi scale: chuyển `DATABASE_URL` sang Postgres (Neon/Supabase).
- **Mail OTP**: bắt buộc cấu hình SMTP — nếu thiếu, API trả `devCode` lộ mã ra client.
- **Đổi mật khẩu admin** ngay sau lần login đầu (qua `/forgot-password` flow đã làm).
- File `data/prod.db` mount volume — không bị mất khi `docker compose down`.
