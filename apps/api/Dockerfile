# =====================================================================
# TAMAM API — multi-stage build for the pnpm workspace.
# Build from the REPOSITORY ROOT:
#   docker build -f apps/api/Dockerfile -t tamam/api:local .
# =====================================================================
ARG NODE_VERSION=22-alpine

# ------------------------------------------------------------------ base
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl + libc6-compat are required by the Prisma query engine on Alpine.
RUN apk add --no-cache openssl libc6-compat dumb-init \
    && corepack enable
WORKDIR /app

# --------------------------------------------------------------- deps
# Only the manifests, so the install layer is cached until a dependency changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/ui-tokens/package.json packages/ui-tokens/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# -------------------------------------------------------------- build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
# Shared packages first — the API imports their compiled output.
RUN pnpm --filter @tamam/shared-types --filter @tamam/validation build \
    && pnpm --filter @tamam/api exec prisma generate \
    && pnpm --filter @tamam/api build

# ------------------------------------------------------------- runtime
FROM base AS runtime
ENV NODE_ENV=production
ENV RUN_MIGRATIONS=false
ENV PORT=3000

# The whole built workspace is carried over: the Prisma CLI (used by the
# entrypoint for `migrate deploy`) and the generated query engine live in
# node_modules and cannot be reinstalled without the dev dependency tree.
COPY --from=build /app /app

# Non-root: the process never needs to write outside /tmp.
RUN addgroup -g 10001 -S tamam \
    && adduser -u 10001 -S tamam -G tamam \
    && chown -R tamam:tamam /app
USER tamam:tamam

WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
