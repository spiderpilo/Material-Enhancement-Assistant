# syntax=docker/dockerfile:1
# Build context is the repository root (see compose.yaml and .github/workflows).

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Local development with hot reload (compose.yaml targets this stage).
FROM deps AS dev
COPY frontend ./
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS builder
COPY frontend ./
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# production API URL must be known here, not when the container starts.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then \
        echo "NEXT_PUBLIC_API_BASE_URL build arg is required for the production image" >&2; exit 1; \
    fi \
    && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
# Render injects PORT (default 10000); Docker sets HOSTNAME to the container id,
# so force the standalone server to listen on all interfaces.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
