# Solid 2's native compiler currently publishes a glibc Linux binary and a
# WASI fallback whose initialization is not reliable in the Alpine builder.
# Use the official Debian Bun builder; the minimal runtime stays on Alpine.
FROM oven/bun:1.3.11 AS builder
WORKDIR /app

# Install deps from monorepo root + all workspaces (lockfile requires all workspace package.jsons)
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY packages/admin-core/package.json ./packages/admin-core/
RUN bun install --frozen-lockfile

COPY apps/admin ./apps/admin
COPY packages/admin-core ./packages/admin-core

# Build with the platform boundary closed. Server environment is read and
# validated when the resulting process boots, so production credentials and a
# reachable production database never belong in the image-build context.
RUN cd apps/admin && ADMIN_RUNTIME=platform-disabled bun run build

# Dereference Bun's workspace link at the package boundary so the runtime copy
# does not depend on Bun's internal content-store path.
RUN cp -RL apps/admin/node_modules/srvx /srvx-runtime

# The audited one-shot auth utilities. They operate on Better Auth's database
# contract and are invoked as ops/*.js inside the running image.
RUN cd apps/admin && bun build \
    scripts/audit-auth.ts \
    scripts/bootstrap-admin.ts \
    scripts/verify-existing-owners.ts \
    --target=bun \
    --splitting \
    --minify \
    --outdir=ops

FROM oven/bun:1.3.11-alpine
WORKDIR /app

COPY --from=builder /app/apps/admin/dist ./dist
COPY --from=builder /app/apps/admin/server.mjs ./server.mjs
COPY --from=builder /srvx-runtime ./node_modules/srvx
COPY --from=builder /app/apps/admin/ops ./ops

ENV NODE_ENV=production
ENV ADMIN_RUNTIME=production
ENV PORT=3002
EXPOSE 3002

RUN addgroup -g 1001 -S nodejs && adduser -S yah-admin -u 1001 -G nodejs
USER yah-admin

CMD ["bun", "server.mjs"]
