FROM node:20 AS builder
WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install deps (including dev deps for build)
RUN npm ci --no-audit --no-fund

# Copy the rest of the repo
COPY . ./

# Build client and server
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Copy only the built server and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
