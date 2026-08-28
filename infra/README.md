# Infra

Production stack for y4h.org, run via Docker Compose on the VPS
(`deploy@`, `/home/deploy/yah`) behind Cloudflare.

## Operator SSH target

Do not use `y4h.org` as the SSH hostname. It is the Cloudflare-facing
application domain and does not expose the VPS's SSH service. Use the direct
VPS address stored in the GitHub Actions `VPS_HOST` secret or the operator's
local SSH configuration, with the `deploy` user. Keep the origin address out of
this public repository.

## Services

Caddy (reverse proxy + TLS) fronts everything: the SvelteKit site, the admin
app (`admin.y4h.org`), the Storyblok preview build (`preview.y4h.org`), Shlink,
Umami, Listmonk (`mail.y4h.org`), and Uptime Kuma. See `docker-compose.yml`.

## Deploys

Pushing to `main` triggers `.github/workflows/deploy-infra.yml` whenever
`infra/caddy/Caddyfile`, `infra/docker-compose.yml`, `infra/config/**`,
`infra/scripts/**`, or the workflow itself changes. The workflow SSHes in and
runs only Caddy:

```sh
cd /home/deploy/yah && git pull --ff-only origin main
cd infra
sh scripts/validate-printed-shortlinks.sh caddy/Caddyfile
docker compose run --rm --no-deps caddy validate --config /etc/caddy/Caddyfile
docker compose up -d --no-deps --pull never --wait caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

Automatic infrastructure deploys never reconcile the admin, web, PostgreSQL,
Listmonk, Shlink, Umami, or Uptime Kuma. A Compose change for an application is
applied only by its exact-tag application workflow (or an equivalent targeted
operator deploy). A Compose image or configuration change for a stateful
provider is inert until an operator follows its maintenance runbook and targets
that service explicitly. This is intentional: Shlink migrates its private
database during image upgrades, and Listmonk v6.2 requires an explicit
stopped-service database migration.

The admin and web workflows use an exact commit-SHA image by default and
`--no-deps --pull never --wait` for only the images they just pulled. All three
deployment jobs share the GitHub
`production-vps` concurrency group and take
`/home/deploy/yah/.production-deploy.lock` over SSH. Operators must take the
same `flock` lock before manual maintenance. Do not restore or replace the
shared `postgres_data` volume to roll back one application; restore only that
application's database.

Production providers are pinned to immutable release digests in Compose.
`LISTMONK_IMAGE` exists only for the documented database-aware v6.0 rollback;
do not persist an override in `infra/.env` or use it as a floating deployment
setting. The complete Listmonk v6.2 and printed-QR Shlink procedure is in
[`docs/admin-stabilization.md`](../docs/admin-stabilization.md#listmonk-v62-production-maintenance-runbook).

Secrets live in `/home/deploy/yah/infra/.env` on the VPS (gitignored; see
`.env.production.example`). Running `docker compose config` locally without that
file prints harmless `variable is not set` warnings. The application env files
are also intentionally absent from a checkout, so use
`docker compose config --no-env-resolution --no-path-resolution --quiet` for a
source-only Compose validation.

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
