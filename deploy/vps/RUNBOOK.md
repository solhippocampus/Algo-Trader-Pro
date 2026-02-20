# VPS Runbook (Live Trading)

This runbook deploys the backend/bot on a Binance-eligible VPS region.

## 1) VPS requirements

- Ubuntu 22.04+
- Public internet + open inbound TCP `5000` (or reverse proxy)
- Region where Binance API access is allowed for your account

## 2) Bootstrap (first time)

```bash
curl -fsSL https://raw.githubusercontent.com/solhippocampus/Algo-Trader-Pro/main/deploy/vps/bootstrap.sh -o bootstrap.sh
bash bootstrap.sh
```

If your repo/dir differs:

```bash
APP_DIR=/opt/algo-trader-pro REPO_URL=https://github.com/solhippocampus/Algo-Trader-Pro.git BRANCH=main bash bootstrap.sh
```

## 3) Configure secrets

```bash
cd /opt/algo-trader-pro
nano .env.production
```

Minimum required keys:

- `TRADING_MODE=LIVE`
- `BINANCE_API_KEY=...`
- `BINANCE_SECRET_KEY=...`
- `COINMARKET_API_KEY=...`
- `AUTO_START_BOT=true`

## 4) Deploy / update

```bash
cd /opt/algo-trader-pro
bash deploy/vps/deploy.sh
```

For future updates, run the same command again.

## 5) Verify

```bash
pm2 status
pm2 logs algo-trader-pro --lines 100
curl http://127.0.0.1:5000/api/bot/status
curl http://127.0.0.1:5000/api/trading/account-balance
```

Expected:

- `bot/status` returns `isRunning: true`
- `account-balance` returns balances (not 500)

## 6) Optional: point Vercel frontend to VPS API

If you move backend off Render, update [vercel.json](../../vercel.json):

- change rewrite destination from Render URL to your VPS URL.
