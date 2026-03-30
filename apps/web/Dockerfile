FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install deps from monorepo root + this workspace only
COPY package.json bun.lockb turbo.json ./
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

COPY apps/web ./apps/web

ARG VITE_STORYBLOK_TOKEN
ARG VITE_STORYBLOK_IS_PREVIEW
ARG VITE_SITE_URL=https://y4h.org
ARG VITE_UMAMI_URL
ARG VITE_UMAMI_WEBSITE_ID

RUN cd apps/web && bun run build

FROM oven/bun:1-alpine
WORKDIR /app

COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/apps/web/package.json ./package.json
RUN bun install --production

ENV NODE_ENV=production
EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && adduser -S sveltekit -u 1001
USER sveltekit

CMD ["bun", "build"]
