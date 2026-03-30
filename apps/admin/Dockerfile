FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install deps from monorepo root + all workspaces (lockfile requires all workspace package.jsons)
COPY package.json bun.lock turbo.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

COPY apps/admin ./apps/admin

# Placeholder build-time args — actual values are injected at runtime via env_file
ARG BETTER_AUTH_SECRET=build-placeholder
ARG BETTER_AUTH_URL=https://y4h.org
ARG DATABASE_URL=postgres://localhost/build

RUN cd apps/admin && bun run build

FROM oven/bun:1-alpine
WORKDIR /app

COPY --from=builder /app/apps/admin/.output ./.output

ENV NODE_ENV=production
EXPOSE 3002

RUN addgroup -g 1001 -S nodejs && adduser -S yah-admin -u 1001
USER yah-admin

CMD ["bun", ".output/server/index.mjs"]
