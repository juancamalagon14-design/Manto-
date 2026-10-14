# ==============================================================================
# Manto 2.0 Backend - Multi-Stage Production Dockerfile
# Optimized for Node.js 20 Alpine, NestJS build, SQL migrations, Non-Root execution
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Resolution (deps)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for Nest build)
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Compilation & Optimization (builder)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile NestJS TypeScript application into dist/
RUN npm run build

# Prune devDependencies to keep only production packages
RUN npm prune --production

# Ensure SQL migrations directory exists and copies any migrations
RUN mkdir -p dist/database/migrations && \
    (cp src/database/migrations/*.sql dist/database/migrations/ 2>/dev/null || true)

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime (runner)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
# Install curl for container healthcheck probe and ca-certificates for external TLS
RUN apk add --no-cache curl ca-certificates

WORKDIR /app

# Production environment defaults
ENV NODE_ENV=production \
    PORT=3003

# Prepare directory structure with non-root node ownership
RUN chown -R node:node /app

# Copy compiled artifacts and production dependencies from builder
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# Guarantee migrations directory exists and has correct permissions
RUN mkdir -p /app/dist/database/migrations && chown -R node:node /app/dist/database/migrations

# Execute under non-root built-in node user (UID 1000)
USER node

EXPOSE 3003

# Healthcheck probe pointing to /health
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3003}/health || exit 1

# Production entrypoint
CMD ["node", "dist/main.js"]
