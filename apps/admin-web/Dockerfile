# =====================================================================
# TAMAM Admin (Next.js) — multi-stage build for the pnpm workspace.
# Requires `output: 'standalone'` in apps/admin-web/next.config.mjs.
# Build from the REPOSITORY ROOT:
#   docker build -f apps/admin-web/Dockerfile -t tamam/admin-web:local .
# =====================================================================
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache libc6-compat dumb-init && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/admin-web/package.json apps/admin-web/
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/ui-tokens/package.json packages/ui-tokens/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @tamam/admin-web...

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin-web/node_modules ./apps/admin-web/node_modules
# The shared packages are compiled here, so they need the dependencies the deps
# stage installed for them. Without this line tsc reports "Cannot find module
# 'zod'" and the build dies before Next.js is ever reached.
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/admin-web ./apps/admin-web
RUN pnpm --filter @tamam/ui-tokens generate \
    && pnpm --filter @tamam/shared-types --filter @tamam/validation build \
    && pnpm --filter @tamam/admin-web build

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache dumb-init \
    && addgroup -g 10001 -S tamam \
    && adduser -u 10001 -S tamam -G tamam
WORKDIR /app

# `output: 'standalone'` emits a self-contained server with only the modules it uses.
COPY --from=build --chown=tamam:tamam /app/apps/admin-web/.next/standalone ./
COPY --from=build --chown=tamam:tamam /app/apps/admin-web/.next/static ./apps/admin-web/.next/static
COPY --from=build --chown=tamam:tamam /app/apps/admin-web/public ./apps/admin-web/public

USER tamam:tamam
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/admin-web/server.js"]
