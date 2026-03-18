FROM node:22-alpine3.21 AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env vars needed by SvelteKit/Vite
ARG VITE_STORYBLOK_TOKEN
ARG VITE_STORYBLOK_IS_PREVIEW
ARG VITE_SITE_URL=https://y4h.org
ARG VITE_UMAMI_URL
ARG VITE_UMAMI_WEBSITE_ID
ARG BETTER_AUTH_SECRET=build-placeholder
ARG BETTER_AUTH_URL=https://y4h.org
ARG DATABASE_URL=postgres://localhost/build

RUN npm run build
RUN npm prune --production

FROM node:22-alpine3.21

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && adduser -S sveltekit -u 1001
USER sveltekit

CMD ["node", "build"]
