# syntax=docker/dockerfile:1
# =============================================================================
# Postplan — production Dockerfile for Railway
# =============================================================================
# Multi-stage build: deps → builder → runner.
# Final image: ~150MB based on Alpine, runs Next.js standalone server.
#
# Build:    docker build -t postplan .
# Run:      docker run -p 3000:3000 --env-file .env.production postplan
# =============================================================================

# ---- Stage 1: install deps ---------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat is needed for some Node native modules (sharp, supabase-js)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---- Stage 2: build the Next.js app -----------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Public env vars are baked into the build at this stage. We accept them as
# build args from Railway. Other (server-only) env vars are read at runtime
# from the container environment, so they don't need to be passed here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry is anonymous but unnecessary in production builds — disable.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Stage 3: runtime image --------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# libc6-compat is required by sharp's prebuilt native binaries on Alpine
RUN apk add --no-cache libc6-compat

# Run as non-root for safety
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what we need at runtime — Next.js standalone gives us a slim
# server.js + bundled deps. Static assets go into .next/static.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# sharp is used by next/image for runtime image optimization. Next.js standalone
# output tracer doesn't always pick it up, so we copy it explicitly from the
# builder's node_modules into the runtime's node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp

USER nextjs

EXPOSE 3000

# Railway sends SIGTERM to gracefully stop containers; Node handles it natively.
CMD ["node", "server.js"]