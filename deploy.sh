#!/usr/bin/env bash
# Deploy aigateway lên VPS Linux
# Cách dùng:
#   ./deploy.sh           # build + up + seed (idempotent)
#   ./deploy.sh update    # git pull + rebuild + restart
#   ./deploy.sh logs      # xem logs realtime
#   ./deploy.sh stop      # dừng container
#   ./deploy.sh status    # xem trạng thái

set -euo pipefail

cd "$(dirname "$0")"

ACTION="${1:-up}"

require_env() {
  if [[ ! -f .env ]]; then
    echo "✗ Thiếu file .env"
    echo "  Chạy: cp .env.production.example .env && nano .env"
    exit 1
  fi
}

ensure_docker() {
  if ! command -v docker &>/dev/null; then
    echo "→ Cài Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "⚠ Logout/login lại để áp group docker, rồi chạy lại script."
    exit 0
  fi
  if ! docker compose version &>/dev/null; then
    echo "✗ Cần Docker Compose plugin v2"
    exit 1
  fi
}

cmd_up() {
  require_env
  ensure_docker
  echo "→ Build + start container..."
  docker compose up -d --build
  echo "→ Đợi container healthy..."
  sleep 5
  echo "→ Seed admin (skip nếu đã tồn tại)..."
  # shellcheck disable=SC1091
  set -a; source .env; set +a
  docker compose exec -T \
    -e ADMIN_EMAIL="${ADMIN_EMAIL:-}" \
    -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
    aigateway node scripts/seed.js || true
  echo
  echo "✓ Đã chạy. Kiểm tra:"
  echo "  curl http://localhost:${HOST_PORT:-3000}/api/health"
  docker compose ps
}

cmd_update() {
  require_env
  ensure_docker
  echo "→ Pull code mới..."
  git pull
  echo "→ Rebuild + restart..."
  docker compose up -d --build
  docker compose ps
}

cmd_logs() {
  docker compose logs -f --tail=100 aigateway
}

cmd_stop() {
  docker compose stop
  docker compose ps
}

cmd_status() {
  docker compose ps
  echo
  echo "Health:"
  curl -fsS "http://localhost:${HOST_PORT:-3000}/api/health" 2>/dev/null && echo " ✓" || echo " ✗"
}

case "$ACTION" in
  up|"")  cmd_up ;;
  update) cmd_update ;;
  logs)   cmd_logs ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  *)
    echo "Usage: $0 [up|update|logs|stop|status]"
    exit 1
    ;;
esac
