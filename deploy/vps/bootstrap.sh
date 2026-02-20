#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/algo-trader-pro}"
REPO_URL="${REPO_URL:-https://github.com/solhippocampus/Algo-Trader-Pro.git}"
BRANCH="${BRANCH:-main}"

echo "[bootstrap] Installing system packages"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential

if ! command -v node >/dev/null 2>&1; then
  echo "[bootstrap] Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[bootstrap] Installing PM2"
  sudo npm install -g pm2
fi

echo "[bootstrap] Preparing app directory: ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${USER}:${USER}" "${APP_DIR}"

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "[bootstrap] Cloning repository"
  git clone -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  echo "[bootstrap] Repository already exists, skipping clone"
fi

cd "${APP_DIR}"

if [ ! -f .env.production ]; then
  echo "[bootstrap] Creating .env.production from template"
  cp deploy/vps/.env.production.example .env.production
  echo "[bootstrap] Fill .env.production before first deploy"
fi

echo "[bootstrap] Configuring PM2 startup"
pm2 startup systemd -u "${USER}" --hp "${HOME}" || true

echo "[bootstrap] Done"
echo "Next: edit ${APP_DIR}/.env.production then run: bash deploy/vps/deploy.sh"
