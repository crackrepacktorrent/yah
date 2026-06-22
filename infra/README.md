# Infra

Production stack for y4h.org, run via Docker Compose on the VPS
(`deploy@`, `/home/deploy/yah`) behind Cloudflare.

## Services

Caddy (reverse proxy + TLS) fronts everything: the SvelteKit site, the admin
app (`admin.y4h.org`), the Storyblok preview build (`preview.y4h.org`), Shlink,
Umami, Listmonk (`mail.y4h.org`), and Uptime Kuma. See `docker-compose.yml`.

## Deploys

Pushing to `main` triggers `.github/workflows/deploy-infra.yml` whenever
`infra/caddy/Caddyfile`, `infra/docker-compose.yml`, `infra/config/**`,
`infra/scripts/**`, or the workflow itself changes. The workflow SSHes in and
runs:

```sh
cd /home/deploy/yah && git pull origin main
cd infra && docker compose up -d
docker exec yah-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

`docker compose up -d` only recreates a container when its image or spec
changed; otherwise containers keep running and `caddy reload` applies config
changes with zero downtime.

Secrets live in `/home/deploy/yah/infra/.env` on the VPS (gitignored; see
`.env.production.example`). Running `docker compose config` locally without that
file prints harmless `variable is not set` warnings.

## Gotcha: never bind-mount the Caddyfile as a single file

The Caddy config is mounted as a **directory** (`./caddy:/etc/caddy:ro`), not a
single file. This is deliberate.

A single-file bind mount (`./Caddyfile:/etc/caddy/Caddyfile`) pins to the
file's inode at container start. `git pull` rewrites a tracked file by writing a
temp file and renaming it over the target, which creates a **new inode**. The
container's mount still points at the old inode, so it keeps serving stale
config — and `caddy reload` "succeeds" while reloading the old file. This bit us
once: an `X-Frame-Options` change stayed stuck on the old value until the caddy
container was force-recreated.

Directory bind mounts track entries live, so a replaced file inside the
directory is visible immediately and `caddy reload` picks it up. Keep the
Caddyfile inside `infra/caddy/` and mount the directory.
