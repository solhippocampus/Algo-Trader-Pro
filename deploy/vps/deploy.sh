#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/algo-trader-pro}"
BRANCH="${BRANCH:-main}"

cd "${APP_DIR}"

if [ ! -f .env.production ]; then
  echo "[deploy] Missing .env.production file"
  echo "Copy deploy/vps/.env.production.example to .env.production and fill secrets"
  exit 1
fi

echo "[deploy] Updating source"
git fetch origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "[deploy] Installing dependencies"
npm ci

echo "[deploy] Building app"
npm run build

echo "[deploy] Loading environment"
set -a
source .env.production
set +a

echo "[deploy] Restarting PM2"
pm2 start ecosystem.config.js --only algo-trader-pro --update-env || pm2 start ecosystem.config.js --update-env
pm2 save

echo "[deploy] Health check"
sleep 2
curl -fsS "http://127.0.0.1:${PORT:-5000}/api/bot/status" || true

echo "[deploy] Completed"
