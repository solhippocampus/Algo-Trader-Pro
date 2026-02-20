# Deployment Guide

This document covers two pieces:

- Deploying the frontend to Netlify (static site)
- Running the backend/bot as a continuously running service (recommended: Render, Railway, or a VPS with Docker + PM2)

1) Netlify (Frontend)

- In Netlify, create a new site from Git and point it to this repository.
- Build command: `npm run build:client`
- Publish directory: `client/dist`
- Environment variables: add `NODE_ENV=production` if needed.

Alternatively, you can run locally:

```bash
npm ci
npm run build:client
# Serve the built site locally e.g. with a static server
npx serve client/dist
```

2) Backend / Bot (Always-on options)

Recommended: Use a dedicated host for the bot (Render, Railway, Fly, DigitalOcean App Platform) or a small VPS.

Option A — Deploy with Docker (Render/Personal VPS)

- Build image and run:

```bash
docker build -t algo-trader-pro .
docker run -d --name algo-trader-pro -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DATABASE_URL="your_database_url" \
  -e BINANCE_API_KEY="..." \
  -e BINANCE_API_SECRET="..." \
  algo-trader-pro
```

Option B — VPS + PM2

- SSH into the server, clone the repo, install Node and PM2:

```bash
sudo apt update && sudo apt install -y nodejs npm
npm ci
npm run build
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

Option C — Managed services

- Services like Render or Railway can build the repository using the included `Dockerfile` or `npm run build` scripts. Configure environment variables in the service UI and set the start command to `node dist/index.cjs`.

3) Environment variables

- Copy `.env.example` to `.env` and fill in values for `DATABASE_URL`, `BINANCE_API_KEY`, and `BINANCE_API_SECRET`.

5) GitHub Actions / Secrets (recommended for automated deploys)

- Netlify automatic deploy (workflow added at `.github/workflows/netlify.yml`):
  - Add repository secrets: `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` (Site ID available in Netlify site settings).

- Render automatic deploy (workflow added at `.github/workflows/render-deploy.yml`):
  - Add repository secrets: `RENDER_API_KEY` and `RENDER_SERVICE_ID`.
  - The workflow triggers Render's deploy API after building the repo. For most cases you can also connect Render to the Git repo directly and skip API keys.


4) Notes and safety

- For real money trading (LIVE mode) ensure your API keys have proper permissions and IP whitelisting where available.
- Use a secure secret store for production and never commit secrets to the repo.
