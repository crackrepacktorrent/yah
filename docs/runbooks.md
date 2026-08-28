# Production runbooks

Operational procedures for the YAH VPS. This file holds only what is still
live: recovery paths, retained artifacts, and standing constraints. It replaces
`admin-stabilization.md`, which was the Solid 1 → Solid 2 admin migration
ledger and was removed once that migration completed.

Everything here runs from `/home/deploy/yah/infra` unless stated otherwise.
Secrets live in `/home/deploy/yah/infra/.env` and
`/home/deploy/yah/apps/admin/.env.production`; both are untracked and exist
only on the host.

## Deployment locking

Any maintenance that stops a stateful provider takes the host lock first:

```sh
exec 9>/home/deploy/yah/.production-deploy.lock
flock --timeout 900 9
```

Automatic infrastructure deploys never reconcile the admin, web, PostgreSQL,
Listmonk, Shlink, Umami, or Uptime Kuma. A Compose image or configuration
change for a stateful provider is inert until an operator follows its runbook
and targets that service explicitly.

## Retained rollback artifacts

Do not run automatic image pruning while these are retained.

| artifact | exact identity |
| --- | --- |
| Listmonk (running) | `listmonk/listmonk:v6.2.0@sha256:f535d59e14991337a9f2d570273685378ae86b0d7698c3e00da444e3bc205286` |
| Listmonk (rollback) | `listmonk/listmonk:v6.0.0@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1` |
| Frozen pre-upgrade database | `listmonk_v60_pre_v62` (connection-disabled clone) |
| Restricted dumps | `listmonk-v60.dump`, plus the Shlink dump and checksums |
| Shlink | `shlinkio/shlink:5.0.1@sha256:a6d8508bc6b0eba5a28e1ee8b64dd5253434cd113c950e715baab4020edcd2a1` |

`LISTMONK_IMAGE` exists only for the documented v6.0 rollback. Do not persist
an override in `infra/.env` or use it as a floating deployment setting.

Production was upgraded to v6.2.0 on 2026-08-28. Once production writes have
occurred on v6.2, prefer forward repair: swapping to the frozen database
discards every subscriber, analytic, bounce, and campaign change made since.

## Listmonk rollback to v6.0

Roll back only before reopening writes, and only if the migration, token,
version, counts, SMTP/template shape, public read, adapter probes, or Shlink
invariants fail.

With callers stopped, preserve the failed database and perform this ordered
swap. Each `psql -c` is a separate transaction; this is deliberately not
atomic.

```sh
docker compose stop yah-admin listmonk
docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE listmonk WITH ALLOW_CONNECTIONS false;" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'listmonk' AND pid <> pg_backend_pid();" \
  -c "ALTER DATABASE listmonk RENAME TO listmonk_v62_failed;" \
  -c "ALTER DATABASE listmonk_v60_pre_v62 WITH ALLOW_CONNECTIONS true;" \
  -c "ALTER DATABASE listmonk_v60_pre_v62 RENAME TO listmonk;"

test "$(docker compose exec -T postgres psql -U postgres -d postgres -Atc \
  "SELECT datname || '|' || datallowconn FROM pg_database WHERE datname IN ('listmonk', 'listmonk_v62_failed') ORDER BY datname;")" = \
  "$(printf 'listmonk|t\nlistmonk_v62_failed|f')"

LISTMONK_IMAGE='listmonk/listmonk:v6.0.0@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1' \
  docker compose up -d --no-deps --pull never --wait listmonk
```

Re-run the v6.0 version/token, data, public route, and every Shlink/printed-QR
invariant while the admin stays stopped. Only then:

```sh
docker compose start yah-admin
```

If the frozen clone is unavailable, restore only `listmonk-v60.dump` into a
newly created `listmonk` database. Never restore the shared `postgres_data`
volume or the Shlink dump as part of a Listmonk rollback.

If any rename fails, keep both callers stopped and inspect `pg_database`
before issuing another rename. The intended state is exactly one
connection-enabled `listmonk` plus a connection-disabled preserved failed
database. Never guess from command position, and never start either
application while no database — or the wrong database — is named `listmonk`.

A v6.2 note: the v6.2 migration hashes API tokens, so a v6.0 binary cannot be
started against the upgraded database. Rollback means restoring or swapping
back the database, never only changing the image. Existing plaintext tokens
still authenticate, but are no longer readable from `users.password`.

## Listmonk settings must never hold JSON `null`

Several Listmonk settings are Go slices. A nil slice marshals to JSON `null`
rather than `[]`, and Listmonk's own admin UI dereferences some of them
unguarded — `bounce.mailboxes: null` breaks its Settings page, not just ours.
The provider seeds them as `[]` or real defaults, so a `null` is always the
result of a bad `PUT` round trip, and it is self-perpetuating.

Check with:

```sh
echo "SELECT key FROM settings WHERE jsonb_typeof(value) = 'null';" \
  | docker compose exec -T postgres psql -U postgres -d listmonk -At
```

Repair through the provider's own write path, never with direct SQL — the app
caches settings in memory and reloads on write:

```sh
curl -X PUT -H "Authorization: token <user:token>" -H 'Content-Type: application/json' \
  --data '[]' http://127.0.0.1:9000/api/settings/<key>
```

Each per-key `PUT` triggers a SIGHUP reload about 500 ms later, so allow a few
seconds between writes. `LISTMONK_API_TOKEN` in `apps/admin/.env.production`
already contains the full `username:token` pair — do not prefix the username
again.

Keys that can legitimately arrive `null`: `app.notify_emails`,
`privacy.exportable`, `upload.extensions`, `messengers`, `bounce.mailboxes`,
`bounce.actions`, and `smtp[].email_headers` / `smtp[].from_addresses` on
disabled blocks. `privacy.domain_allowlist`, `privacy.domain_blocklist`,
`security.trusted_urls`, and `smtp` are rebuilt provider-side and cannot.

The admin normalizes the slice cases at its settings read boundary; the repair
above still matters because Listmonk's own UI has no such guard.

## Listmonk admin access

Not exposed publicly. `mail.y4h.org` serves only recipient-facing routes.
Reach the admin UI over an SSH tunnel:

```sh
ssh -L 9000:localhost:9000 deploy@<vps>
```

## Auth maintenance operations

Three audited one-shot executables ship inside the admin image as `ops/*.js`,
built from `apps/admin/scripts/`.

- `ops/audit-auth.js` — reports canonical owners, unverified members and
  sessions, and noncanonical organizations, memberships, invitations, and
  active sessions. Exits nonzero until an operator reviews the findings. The
  deploy workflow runs this **before** replacing the container; a failure
  deliberately stops the rollout with the old container still serving.
- `ops/bootstrap-admin.js` — refuses any non-empty identity database and
  creates the first verified canonical owner atomically, without a session.
- `ops/verify-existing-owners.js` — an attested migration for one concrete
  inventory, not a general recovery tool. Requires an exact allowlist matching
  every canonical member and refuses non-owners, already-verified users,
  unexpected organizations, and ambiguous credentials. Preserves password
  hashes and revokes all sessions in one serializable transaction.

Keep the admin stopped during any mutating run: ordinary requests do not take
the maintenance advisory lock. Take a database-only backup first:

```sh
install -d -m 700 /home/deploy/backups
docker exec yah-postgres-1 pg_dump -U yah -d yah --format=custom --file=/tmp/yah-pre-maintenance.dump
docker cp yah-postgres-1:/tmp/yah-pre-maintenance.dump /home/deploy/backups/
docker exec yah-postgres-1 rm /tmp/yah-pre-maintenance.dump
```

If a mutating run exits ambiguously, do not blindly rerun it. Run the audit: a
clean result proves the commit succeeded; the exact original state permits one
retry. Anything else is an investigation stop.

## Shlink printed-QR constraints

Printed QR codes are generated from each provider `shortUrl` and are **not**
stored in Shlink. The physical codes cannot be reissued.

These seven slugs are undeletable and must stay resolvable:

```
signup  training  campus-training  sign-in  join  whatsapp  donate
```

Editing a protected destination preserves the printed identity. Clearing
visits preserves redirection but destroys analytics. Deletion breaks the
physical QR. The admin blocks deletion in both the server command and the UI,
and rejects any non-null Shlink domain or any shortlink carrying redirect
rules. These are mistake barriers; the database dump, semantic manifest, and
public redirect checks remain the actual recovery barrier.

Inventory baseline: 16 short links, zero custom domains, seven printed-QR
codes, fourteen canonical/legacy printed routes.

## Pending: adopt the Shlink pinned digest

The running Shlink container may still carry the old `latest` Compose label
even though its image bytes match the pinned v5.0.1 digest. Adopting the new
reference requires one recreation, in its own maintenance window.

Take the lock, re-run the full Shlink image/API/printed-route inventory, take a
fresh database-scoped dump, copy it off-host, and restore it into disposable
PostgreSQL with the exact Shlink image before proceeding.

```sh
cd /home/deploy/yah/infra
set -euo pipefail
exec 9>/home/deploy/yah/.production-deploy.lock
flock --timeout 900 9

# Stop the only Shlink-writing application before the baseline and dump.
docker compose stop yah-admin
test -z "$(docker compose ps -q --status running yah-admin)"

docker compose pull shlink
test "$(docker compose config --images | grep '^shlinkio/shlink:')" = \
  'shlinkio/shlink:5.0.1@sha256:a6d8508bc6b0eba5a28e1ee8b64dd5253434cd113c950e715baab4020edcd2a1'
# STOP unless the fresh dump has been restore-tested and the private semantic,
# visit-total, redirect-rule, and fourteen-route snapshots are complete.
docker compose up -d --no-deps --pull never --wait shlink
```

Keep the admin stopped while requiring the same image digest, semantic
catalog, redirect rules, nondecreasing visits, and fourteen printed route
destinations afterward. Reopen only after every comparison succeeds:

```sh
docker compose start yah-admin
```

## Admin runtime modes

`ADMIN_RUNTIME` has two values. `platform-disabled` is the default and serves
only `/api/health`; `production` serves the application. The image sets
`ENV ADMIN_RUNTIME=production`, and Compose sets it again.

`/api/health` reports the active mode, and the deploy workflow asserts
`"runtime":"production"`. This matters because a missing or misnamed runtime
variable falls back to `platform-disabled`, where health still answers 200
while every page 404s — the Compose healthcheck, `--wait`, and a bare
reachability check would all pass over a total outage.
