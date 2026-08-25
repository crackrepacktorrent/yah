FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# The monorepo lockfile needs each workspace manifest even though installation
# is filtered to the public web app.
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
RUN bun install --frozen-lockfile --ignore-scripts --filter yah-dev

COPY apps/web ./apps/web

ARG VITE_STORYBLOK_PUBLIC_TOKEN
ARG VITE_STORYBLOK_IS_PREVIEW
ARG VITE_SITE_URL=https://y4h.org
ARG VITE_UMAMI_URL
ARG VITE_UMAMI_WEBSITE_ID

RUN bun run --cwd apps/web prepare
RUN bun run --cwd apps/web build

FROM oven/bun:1.3.11-alpine
WORKDIR /app

# Keep the runtime dependency install tied to the same reviewed monorepo lockfile
# used by the builder. --ignore-scripts avoids running workspace build hooks in
# the production-only stage.
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
RUN bun install --production --frozen-lockfile --ignore-scripts --filter yah-dev

COPY --from=builder /app/apps/web/build ./apps/web/build

# The filtered install links production dependencies into this workspace.
# Keeping the built server here preserves normal package resolution.
WORKDIR /app/apps/web

ENV NODE_ENV=production
EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && adduser -S sveltekit -u 1001
USER sveltekit

CMD ["bun", "./build/index.js"]
