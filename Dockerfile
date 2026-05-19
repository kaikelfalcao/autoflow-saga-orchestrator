# syntax=docker/dockerfile:1.7
# Template padronizado autoflow (Node 24 + Alpine, multi-stage, USER node, HEALTHCHECK)

# ─── builder ───
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── runner ───
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

# Apenas deps de prod
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build + agente NR
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/newrelic.js ./newrelic.js

EXPOSE 3002

# Healthcheck via /health (cada serviço expõe esse endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://localhost:3002/health" >/dev/null 2>&1 || exit 1

USER node
CMD ["node", "dist/main.js"]
