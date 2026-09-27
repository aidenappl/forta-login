# Next.js Standalone Production Dockerfile
# Optimized for smaller image size using standalone output

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Ensure public exists even if empty
RUN mkdir -p public

# Build args baked into the client bundle at build time. CI passes every
# Keyring secret as a build arg; only the ones declared here reach the build.
# An empty value falls back to the default in code.
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Public OAuth client id (not a secret). Empty disables Google sign-in.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

ARG NEXT_PUBLIC_FORTA_HOME
ENV NEXT_PUBLIC_FORTA_HOME=$NEXT_PUBLIC_FORTA_HOME

# The release on every Monitor event: the short commit SHA from CI, "dev" locally.
ARG NEXT_PUBLIC_APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

# Build the application with standalone output
RUN npm run build

# ---- Runtime Stage ----
FROM node:20-alpine AS runner

# Add curl for health checks
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy standalone output (much smaller than full node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create cache directory and set permissions
RUN mkdir -p .next/cache && \
    chown -R nextjs:nodejs /app

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Next.js standalone server
CMD ["node", "server.js"]
