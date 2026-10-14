# ==============================================================================
# Manto 2.0 Frontend - Multi-Stage Production Dockerfile (Next.js 14 Standalone)
# Optimized for Node.js 20 Alpine, Non-Root execution, Build vs Runtime Env Vars
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Resolution (deps)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./

# Clean install of all dependencies
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Next.js Standalone Compilation (builder)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ------------------------------------------------------------------------------
# BUILD-TIME ENVIRONMENT VARIABLES
# Next.js embeds NEXT_PUBLIC_* variables directly into client-side JS bundles
# during compilation ('next build'). These MUST be supplied at build time.
# ------------------------------------------------------------------------------
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ENV=production

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Compile standalone bundle
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime (runner)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
# Install curl for container healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# ------------------------------------------------------------------------------
# RUNTIME ENVIRONMENT VARIABLES
# Evaluated dynamically at container execution time by Node.js server.
# ------------------------------------------------------------------------------
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME="0.0.0.0"

# Create unprivileged system user/group according to Next.js security standards
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set up runtime cache directory with appropriate permissions
RUN mkdir -p .next && chown -R nextjs:nodejs /app

# Copy public assets and static compilation artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to unprivileged user (UID 1001)
USER nextjs

EXPOSE 3002

# Healthcheck probe pointing to HTTP root
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3002}/ || exit 1

# Launch Next.js standalone server
CMD ["node", "server.js"]
