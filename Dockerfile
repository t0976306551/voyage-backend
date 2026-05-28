# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create non-root user, set up uploads dir with correct ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p uploads && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

CMD ["node", "dist/app.js"]
