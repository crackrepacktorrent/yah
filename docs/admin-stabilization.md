# Admin stabilization and Solid 2 migration ledger

This ledger records what changed, why it changed, and which decisions must be revisited. It keeps the current admin deployable while establishing a protected path to Solid 2.

## Phase 1: stabilization

- [x] Restore every invitation state while collapsing signed-out onboarding into one non-enumerating mailbox-proof path.
- [x] Correct the canonical production auth/admin URL and introduce a validated public-site origin.
- [x] Make routine member removal organization-safe and remove invitation-triggered global-account deletion.
- [x] Centralize typed feature capabilities so navigation, route data, selection, and controls agree.
- [x] Resolve comma-separated Better Auth roles and union their built-in and dynamic permissions.
- [x] Make custom roles assignable while preserving owner-only restrictions.
- [x] Prevent custom-role cloning and direct commands from granting hidden organization/access-control permissions.
- [x] Add strict runtime schemas at server-function boundaries.
- [x] Keep unexpected database and upstream details server-side and give client errors correlation references.
- [x] Add a tested native-fetch boundary with timeouts, content checks, bounded error bodies, and no implicit mutation retries.
- [x] Serialize/fail startup auth migrations and expose database-aware readiness.
- [x] Pin both admin applications to Better Auth 1.6.30 and make admin onboarding invitation-only, mailbox-proven, and resistant to pre-account hijacking.
- [x] Generate absolute, escaped public subscription forms owned by the web application.
- [x] Repair rich-text CSS, disabled behavior, external-value synchronization, async initialization, and teardown.
- [x] Preserve rich-text/date-picker route chunking by removing them from the global component barrel.
- [x] Isolate Sonner behind a local toast facade and lint against new direct imports.
- [x] Correct current TypeScript/ESLint peer ranges and remove the unused direct `clsx` dependency.
- [x] Add focused tests for policies, multi-role resolution, invitation decisions, validation, safe errors, upstream parsing, and generated markup.
- [x] Resolve all material findings from the independent integrated review and complete a clean verification pass.

## Verification

Baseline before stabilization:

- Type-check and production build passed.
- Lint had zero errors and three Solid reactivity warnings.
- The configured Prettier check failed in 111 files.
- No admin tests existed.

Integrated result on 2026-08-25, after the independent-review fixes, auth security update, and browser-harness addition:

- `bun run check`: pass.
- `bun run lint`: pass with no warnings.
- `bun run test`: 46 tests pass, including a real Better Auth contract integration proving that mailbox proof removes an attacker-planted password/session, acceptance requires the mailbox owner's replacement password, arbitrary signup is disabled, and authenticated users cannot create organizations.
- `bun run check:e2e`: pass; `bun run test:e2e -- --list` discovers five current-admin parity tests. Browser execution still requires a database-ready target and purpose-built credentials for the authenticated cases.
- `bun run build`: pass. Lexical and the rich-text editor remain separate client chunks.
- `git diff --check`: pass.
- The operational auth path passed against PostgreSQL 18 in a disposable Docker database. Fresh bootstrap was atomic and refused a second run; the production-owner verification refused an incomplete allowlist without changes, preserved all password fingerprints, revoked every test session, refused repetition, and produced a clean `ops:audit-auth` result. The strengthened audit also refused an injected second null credential row, which was removed after the test.
- The final non-root production admin image built successfully as `yah-admin-review:local` (`sha256:f3fc920c90b1…`). Against the disposable PostgreSQL service it completed startup, returned database-aware health, signed in with the unchanged owner password, resolved the new session, ran the bundled verifier successfully, and passed the bundled post-migration audit.
- `docker compose config --quiet`: reached the expected production-only `apps/admin/.env.production` dependency, then stopped because that untracked secrets file is not present locally. No fake production secrets file was created.
- The repository-wide formatting baseline remains deliberately out of scope. Touched source follows the established tab/single-quote style; formatting the whole app belongs in a separate mechanical change after reconciling the checked-in Prettier configuration with existing source.

## Decisions grounded in history

The current Solid admin was introduced primarily as a one-shot Svelte-to-Solid port in `4997b14`, after the Svelte admin was removed in `848e91a`. Mechanical port artifacts should not automatically be treated as intentional architecture.

### Account lifecycle

- Invitation handling restores the complete flow originally introduced in `6718559` and later regressed across `a0636cd`, `f698fa6`, and `7d3f1c8`. Acceptance is now an explicit action rather than a lifecycle side effect.
- Routine removal now means **remove organization access**, not **delete the global identity**. Global deletion was an explicit single-organization assumption in `6718559` and was manually implemented in `a0636cd` after the Better Auth admin plugin caused context errors. The safer default supports future multi-organization use and reinvitation. If permanent account deletion is still a product need, add a separate owner-only, clearly destructive workflow after checking all memberships; do not overload member removal.
- Startup migrations preserve the fresh-deployment behavior added in `5719a3d`, but an awaited boot gate plus PostgreSQL advisory lock replaces fire-and-forget execution. A deployment/init job remains cleaner at larger replica counts, but the boot gate needs less infrastructure change and prevents serving against a partial schema now.

### Authorization

- Better Auth remains the single authorization authority. The local feature policy controls discoverability and composite UI requirements; every server function independently selects and enforces its canonical permission.
- Custom roles were intentional (`1dcd2c1`, `f46448a`) but had become unassignable in the UI. The implementation completes that feature rather than adding a second policy engine. Role names reject commas because Better Auth uses commas to serialize multiple roles, while member assignment now accepts an explicit array and combines all selected roles.
- Resolving a user's custom permissions does not call Better Auth's role-management endpoint: that endpoint requires `ac:read`, which normal custom roles intentionally cannot receive through this UI. A narrow server-side adapter lookup reads only the active organization's assigned dynamic roles, and the server still uses Better Auth for authorization decisions.
- Custom role keys are immutable. Better Auth renames the role record without rewriting existing comma-separated member assignments, so exposing rename would silently strand users. A future display-name field is preferable to mutable authorization keys.
- Custom roles may grant only the product resources explicitly rendered by the editor. The shared `customRoleStatements` boundary excludes Better Auth's `organization`, `member`, `invitation`, `team`, and `ac` resources; the server rejects those resources and clone projection drops them. This closes a history-derived bug where cloning a built-in owner/admin role copied hidden permissions that the UI could neither show nor remove.
- Member removal preserves the account, and no invitation failure deletes a global identity. A failed acceptance remains safe to retry.
- Invitation IDs are not treated as sufficient mailbox ownership. The anonymous landing response exposes no invited email, account-existence bit, organization, or role. An invitation-bound Better Auth magic link uses hashed, single-use token storage; when it resolves an existing unverified row, Better Auth 1.6.30 removes every unproven credential and session before creating the mailbox owner's fresh verified session. A server-only password setup then establishes the owner's credential, and a Better Auth policy hook refuses membership acceptance until that credential exists.
- Public email/password signup and user-created organizations are disabled. Every permission check and app-session projection is also bound to a verified membership in the canonical `yah` organization, so a legacy rogue organization cannot authorize access to globally shared Listmonk, Shlink, or Umami integrations.
- Fresh bootstrap is an explicit one-shot operation in the admin package: `ops:bootstrap-admin` refuses any non-empty identity database and creates the first verified canonical owner atomically without creating a session. `ops:audit-auth` reports canonical owners, unverified members/sessions, and noncanonical organizations, memberships, invitations, and active sessions; it exits nonzero until an operator reviews the findings.
- A read-only production inventory on 2026-08-25 found exactly one canonical `yah` organization, no noncanonical organizations or memberships, three unverified canonical owners with one credential each, and 35 sessions belonging to unverified users. The organization operator explicitly attested that all three identities and their existing credentials are legitimate. The narrowly scoped `ops:verify-existing-owners` rollout operation therefore requires an exact allowlist matching every canonical member, refuses non-owners, already-verified users, unexpected organizations, and ambiguous credentials, preserves the existing password hashes, marks the owners verified, and revokes all of their sessions in one serializable transaction. This is an attested migration for this concrete inventory, not a general account-recovery feature.
- Password reset revokes all sessions. `emailAndPassword.requireEmailVerification` is enabled, and startup removes sessions belonging to unverified rows before accepting traffic. The first rollout must stop the old container, take a database backup, run the exact attested-owner operation, require a clean auth audit, and only then start the strict-verification image. A generic `UPDATE` that blanket-marks users verified is never an acceptable substitute.
- Secure-link delivery goes through Better Auth's public handler rather than a direct server API call, retaining origin/CSRF checks and the plugin's five-per-minute IP limit. The invitation policy owns the recipient and callbacks, binds the stored token email to a live canonical invitation, and rechecks cancellation/expiry before token consumption. Caddy's actual client-IP chain remains a container-level release test.
- Better Auth 1.6.30 is the safe bridge release, not the endpoint. It covers the stable-line security fixes without changing the shared account identity schema. Version 1.7.1 requires a maintenance window, an inventory/backfill of `account.issuer`, collision review, a non-null constraint, and a unique `(issuer, accountId)` index. It must be a coordinated deployment after Solid 2 parity, not an automatic startup migration or mixed-version rolling deploy. References: [invitation advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-fmh4-wcc4-5jm3), [organization verification contract](https://better-auth.com/docs/plugins/organization#email-verification-requirement), and [1.7 account-identity migration](https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-is-scoped-by-issuer).

Invitation onboarding alternatives were considered explicitly:

| Approach                                          | Advantages                                                                                          | Costs / decision                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email/password signup, then ordinary verification | Familiar form and smallest initial diff.                                                            | Rejected: verifying the shared row promotes an attacker-planted password/session in the pre-account-hijack scenario. Session revocation alone does not remove the planted credential. |
| Invitation URL as the only proof                  | Very simple and no second email.                                                                    | Rejected: leaked IDs would be sufficient for admin membership, which is the threat the upstream invitation hardening addresses.                                                       |
| Email OTP first, then password setup              | Sound mailbox-first architecture and avoids link-scanner consumption.                               | Viable fallback, but adds code-entry state and more UI/test surface. The pinned magic-link implementation already contains the exact unproven-access revocation primitive we need.    |
| Invitation-bound magic link, then password setup  | One built-in, hashed, single-use proof; removes planted credentials/sessions; no schema or package. | Chosen. The email link is intentionally an authentication token, so callback binding, short expiry, one-time consumption, and delivery canaries are release requirements.             |
| Custom provisional-onboarding table               | Maximum control over proof, profile, and credential transaction boundaries.                         | Rejected for now: custom credential lifecycle and schema machinery duplicate Better Auth without a demonstrated requirement.                                                          |

### First strict-verification rollout

The deploy workflow uses an immutable commit-SHA image and runs `ops:audit-auth` before replacing the current container. On the first rollout, that audit is expected to fail because the three attested owners are still unverified. This is the safety gate: the newly built image is available, but the old admin remains running until an operator completes the maintenance sequence below.

Use the exact SHA image built by the gated workflow. Keep the old admin stopped throughout the mutating operation because ordinary requests do not take the maintenance advisory lock.

1. From `/home/deploy/yah/infra`, pull the exact image and stop the existing admin:

   ```sh
   ADMIN_TAG=<40-character-commit-sha> docker compose pull yah-admin
   docker compose stop yah-admin
   ```

2. Create a restricted backup directory and take a database-only custom-format backup:

   ```sh
   install -d -m 700 /home/deploy/backups
   docker exec yah-postgres-1 pg_dump -U yah -d yah --format=custom --file=/tmp/yah-before-owner-verification.dump
   docker cp yah-postgres-1:/tmp/yah-before-owner-verification.dump /home/deploy/backups/yah-before-owner-verification.dump
   docker exec yah-postgres-1 rm /tmp/yah-before-owner-verification.dump
   ```

3. Run the exact image's pre-audit. It must fail only for the already-recorded three unverified owners and their sessions; any topology, credential-count, or duplicate-email difference stops the rollout:

   ```sh
   ADMIN_TAG=<40-character-commit-sha> docker compose run --rm --no-deps yah-admin bun ops/audit-auth.js
   ```

4. Supply all three canonical-member email addresses as the exact allowlist and run the attested operation:

   ```sh
   ADMIN_TAG=<40-character-commit-sha> docker compose run --rm --no-deps \
     --env OWNER_VERIFICATION_EMAILS='owner-one@example.org,owner-two@example.org,owner-three@example.org' \
     --env OWNER_VERIFICATION_CONFIRMATION='preserve-passwords-revoke-sessions' \
     yah-admin bun ops/verify-existing-owners.js
   ```

   Replace the example addresses; do not add those operational values to a tracked env file. The command changes no password or membership data. It verifies the exact existing owner set and revokes its sessions in one transaction.

5. Require the post-audit to exit successfully before starting the application:

   ```sh
   ADMIN_TAG=<40-character-commit-sha> docker compose run --rm --no-deps yah-admin bun ops/audit-auth.js
   ADMIN_TAG=<40-character-commit-sha> docker compose up -d --no-deps --pull never --wait yah-admin
   curl --fail --retry 3 --retry-delay 5 https://admin.y4h.org/api/health
   ```

6. The designated owner signs in with the unchanged password and checks one permissioned read plus one safe mutation. Ask the other two owners only to sign in again when convenient; no password reset or new invitation is required.

If the verifier's client exits ambiguously, do not blindly rerun it. Run the audit: a clean result proves the commit succeeded, while the exact original unverified state permits one retry. Any partial or unexpected state is an investigation stop, although the transaction is designed to make partial commit impossible. If the new application fails after a clean auth migration, start the previous immutable admin image; the auth change is backward-compatible, but all owners must sign in again. Retain the backup until the login canary and invitation smoke test pass.

### External systems and public forms

- Listmonk settings retain the one-GET/one-PUT raw merge from `7ae5d68` and `8e5522e`. Per-key parallel writes are rejected because each settings write can briefly restart Listmonk, and raw merging preserves unknown fields and masked credentials.
- Listmonk v6 token authentication remains `token username:token`, following the corrections recorded in `1e1f057`, `44dc949`, and `0819276`.
- A read-only production inventory on 2026-08-26, using the direct VPS target from local operator configuration rather than the Cloudflare-facing `y4h.org` domain, found a healthy running Listmonk `v6.0.0` container. Its current immutable rollback artifact is `listmonk/listmonk:v6.0.0@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1`. The tracked Compose target is now the tested exact v6.2.0 digest, but automatic infrastructure deploys explicitly exclude Listmonk, so this source change does not mutate the running provider. The direct VPS address is intentionally not recorded in this public repository; operators use the GitHub Actions `VPS_HOST` secret or local SSH configuration. Admin-v2 campaign analytics remains production-ineligible until the explicit runbook below succeeds: its multi-campaign contract requires the v6.2 correctness fix and fails closed on older declared versions.
- Keep Listmonk for admin access mail. Before rollout, provision and canary the transactional template referenced by `LISTMONK_ADMIN_ACCESS_TEMPLATE_ID`; its required payload is `.Tx.Data.access_link`. Startup validates the numeric ID but deliberately does not make app availability depend on a live Listmonk template lookup. The invitation-bound access send is awaited so the UI can report delivery failure; public password-reset delivery is dispatched without awaiting its result to avoid an account-enumeration timing signal and logs background failure server-side.
- Umami retains one shared in-flight token request. Concurrent dashboard calls otherwise create an authentication burst when the cached token expires. This is a narrow concurrency guard, not a general caching layer.
- Public subscription submission remains in `apps/web`, as established in `2eab195`. The admin owns configuration and snippet generation; the web app owns public validation and the unauthenticated Listmonk public API. `PUBLIC_SITE_URL` repairs the relative-link regression introduced when admin moved to its own subdomain in `1408b1c`.
- Embed snippets use the public subscription page in an iframe. A plain cross-origin HTML form would be rejected by SvelteKit's production CSRF origin check; disabling that check globally would weaken every current and future web form action. Caddy removes `X-Frame-Options` and permits framing only for `/subscribe`; every other public route retains the site-wide same-origin policy.

### Server contracts

- Typed object payloads plus Valibot parsing restore the contract model used before the Solid port (`1dcd2c1`, `b144d8a`). TypeScript improves callers; runtime parsing protects the actual trust boundary.
- Native HTML `FormData` is not the command contract. `fb5e9f2` records the concrete checkbox value `"on"` bug that made edits appear saved while validation rejected them.
- Contracts should move beside their feature as slices are migrated. The current shared contract file is a stabilization waypoint, not a target for indefinite growth.

### Listmonk migration architecture

Three independent read-only audits of the current Listmonk features, their git history, the official v6 API, and the Solid 2 dependency surface converged on a feature-owned ports-and-adapters design. The 599-line `apps/admin/src/server/listmonk.ts` is a rollback implementation, not a migration template: it trusts TypeScript assertions for provider responses, leaks snake-case provider DTOs across features, and includes unused methods. Solid 2 receives one tiny Listmonk transport for URL/auth/timeout/envelope/error mechanics and narrow feature adapters that privately validate provider responses with Valibot and project app-owned DTOs.

The measured slice order is templates; lists and subscription-form administration; campaigns; subscribers and subscriber activity; bounces; campaign email analytics; then the corrected single-recipient campaign test-send. Templates went first because they are independently releasable, establish the transport without list/settings complexity, and expose a reusable read-only catalog for campaigns. Lists went next because the old bare `/lists` request silently truncated at Listmonk's default 20 rows and affected list management, subscriber/campaign selectors, and public-form configuration. Campaign authoring then moved ahead of subscribers: its list/template dependencies were already complete, it has no subscriber DTO dependency, and this closes the durable list-wide opt-in resend workflow. After test-send, stop and reassess parity rather than automatically migrating the generic settings, logs, import, media, or placeholder operational surfaces. No git history or current product workflow demonstrates that those broad pages belong in this authenticated product; any later operational capability should enter as a narrow feature with an explicit owner.

History preserves behavior only where it records a real constraint. Template create/default/visual labels remain, the default remains restricted to ordinary campaign templates, and preview stays in `sandbox=""`; client-side bulk template deletion is removed because Listmonk has no bulk-template endpoint and history records no product need for it. The old regex preview is replaced by Listmonk's saved/unsaved preview endpoints because regex substitution can corrupt template expressions. The visual template type remains visible for inventory/parity, but new visual authoring is deferred until a real `body_source` editor exists.

Alternatives were rejected explicitly: copying the horizontal client preserves its coupling; duplicating a complete fetch wrapper per feature invites auth/error drift; a generated OpenAPI client still needs runtime validation and product projection and is premature at the current endpoint count; a direct Listmonk database integration bypasses provider invariants; and a separate BFF duplicates the server-function auth/deployment boundary without another client. A generic repository, command bus, TanStack Query, form library, Zag/Kobalte peer override, durable queue, or compatibility table bridge does not solve a demonstrated requirement in these slices. Keep Valibot, native fetch, native forms/dialogs, and semantic tables. Add server-backed search/order/pagination only when measured inventory or operator workflow requires it.

Development and tracked production configuration are pinned to exact v6.2.0 artifacts. The running production container remains on the inventoried v6.0.0 artifact until the stopped-service maintenance runbook succeeds. Deployment workflows target only stateless services with `--no-deps --pull never`, so merging the pin cannot turn a source push into a provider upgrade.

### Listmonk v6.2 production maintenance runbook

The target is exactly:

```text
listmonk/listmonk:v6.2.0@sha256:f535d59e14991337a9f2d570273685378ae86b0d7698c3e00da444e3bc205286
```

The retained application-and-database rollback target is exactly:

```text
listmonk/listmonk:v6.0.0@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1
```

A disposable PostgreSQL 18 rehearsal on 2026-08-27 installed v6.0, restored representative configuration, upgraded through v6.1 and v6.2, reran the upgrade idempotently, returned `v6.2.0` from authenticated `/api/config`, and passed all three guarded live Listmonk adapter suites. The tests deleted their temporary lists, subscribers, and campaigns. The v6.1 migration rebuilt analytics materialized views; production therefore needs downtime and temporary disk headroom. The v6.2 migration hashes API tokens, so a v6.0 binary cannot be restarted against the upgraded database. Rollback means restoring or swapping back the frozen v6.0 database, never only changing the image.

Production inventory also found zero files in the current container upload directory. Recheck that immediately before maintenance. The new named `listmonk_uploads` volume prevents future container recreation from losing filesystem media; if the count is no longer zero, stop and copy/checksum those files into the volume before continuing.

#### Hard boundaries

- Stop and upgrade only Listmonk. Never run `docker compose down`, a broad `pull`/`up`, or restore the shared `postgres_data` volume.
- PostgreSQL contains separate `listmonk`, `shlink`, `umami`, and auth databases. A Listmonk rollback may touch only `listmonk`.
- Stop the admin during Listmonk downtime so it cannot issue provider commands. The public subscription route will report provider unavailability during the short window; do not pretend those writes were accepted.
- Keep Shlink running and require its container image, semantic shortlink manifest, and printed-QR redirects to be identical before and after. Do not recreate Shlink in this window.
- Take the host deployment lock below. GitHub deploy jobs use the same lock and a shared `production-vps` concurrency group.
- Stop if there is an active import/campaign, an unexpected custom Shlink domain, any Shlink redirect rule, missing printed slug, nonzero unhandled media count, failed backup restore test, insufficient disk, or any inventory drift that has not been explained.

#### Preflight and recovery artifacts

Run from an interactive operator shell on the VPS. Keep the shell open; file descriptor 9 owns the maintenance lock until the shell exits.

```sh
cd /home/deploy/yah/infra
set -euo pipefail
exec 9>/home/deploy/yah/.production-deploy.lock
flock --timeout 900 9

git pull --ff-only origin main
docker compose config --no-env-resolution --quiet
test "$(docker compose config --images | grep '^listmonk/listmonk:')" = \
  'listmonk/listmonk:v6.2.0@sha256:f535d59e14991337a9f2d570273685378ae86b0d7698c3e00da444e3bc205286'

docker compose pull listmonk
docker pull 'listmonk/listmonk:v6.0.0@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1'

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/home/deploy/backups/listmonk-v62-${STAMP}"
install -d -m 700 "$BACKUP_DIR"

docker compose ps postgres listmonk shlink yah-admin > "$BACKUP_DIR/services.before.txt"
docker inspect --format '{{.Config.Image}}|{{.Image}}' "$(docker compose ps -q listmonk)" > "$BACKUP_DIR/listmonk-image.before.txt"
docker inspect --format '{{.Config.Image}}|{{.Image}}' "$(docker compose ps -q shlink)" > "$BACKUP_DIR/shlink-image.before.txt"
LISTMONK_RUNNING_IMAGE_ID=$(docker inspect --format '{{.Image}}' "$(docker compose ps -q listmonk)")
SHLINK_RUNNING_IMAGE_ID=$(docker inspect --format '{{.Image}}' "$(docker compose ps -q shlink)")
docker image inspect "$LISTMONK_RUNNING_IMAGE_ID" --format '{{json .RepoDigests}}' \
  > "$BACKUP_DIR/listmonk-repo-digests.before.json"
docker image inspect "$SHLINK_RUNNING_IMAGE_ID" --format '{{json .RepoDigests}}' \
  > "$BACKUP_DIR/shlink-repo-digests.before.json"
jq -e 'index("listmonk/listmonk@sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1") != null' \
  "$BACKUP_DIR/listmonk-repo-digests.before.json"
jq -e 'index("shlinkio/shlink@sha256:a6d8508bc6b0eba5a28e1ee8b64dd5253434cd113c950e715baab4020edcd2a1") != null' \
  "$BACKUP_DIR/shlink-repo-digests.before.json"
curl -fsS https://y4h.link/rest/health > "$BACKUP_DIR/shlink-health.before.json"
# Close the only admin writer before checking either provider's quiet state.
docker compose stop yah-admin
docker compose exec -T listmonk sh -c 'find /listmonk/uploads -type f 2>/dev/null | wc -l' > "$BACKUP_DIR/listmonk-upload-count.before.txt"
test "$(cat "$BACKUP_DIR/listmonk-upload-count.before.txt")" -eq 0

# Prove provider/database identity before any privileged maintenance command.
docker compose exec -T postgres psql -U postgres -d postgres -Atc \
  "SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname IN ('listmonk', 'shlink') ORDER BY datname;" \
  > "$BACKUP_DIR/provider-database-owners.before.txt"
grep -Fx 'listmonk|listmonk' "$BACKUP_DIR/provider-database-owners.before.txt"
grep -Fx 'shlink|shlink' "$BACKUP_DIR/provider-database-owners.before.txt"
test "$(wc -l < "$BACKUP_DIR/provider-database-owners.before.txt")" -eq 2

# A frozen clone plus the temporary v6.1 analytics views need real headroom on
# the PostgreSQL volume. This deliberately requires two database sizes plus 1 GiB free.
LISTMONK_DB_BYTES=$(docker compose exec -T postgres psql -U postgres -d postgres -Atc \
  "SELECT pg_database_size('listmonk');")
PG_FREE_KIB=$(docker compose exec -T postgres df -Pk /var/lib/postgresql/data | awk 'NR == 2 { print $4 }')
REQUIRED_FREE_KIB=$(( (LISTMONK_DB_BYTES * 2 + 1073741824 + 1023) / 1024 ))
printf 'listmonk_db_bytes=%s\npostgres_free_kib=%s\nrequired_free_kib=%s\n' \
  "$LISTMONK_DB_BYTES" "$PG_FREE_KIB" "$REQUIRED_FREE_KIB" \
  > "$BACKUP_DIR/postgres-headroom.before.txt"
test "$PG_FREE_KIB" -ge "$REQUIRED_FREE_KIB"

# Verify the actual running release and token before trusting the baseline.
read -rsp 'Listmonk username:token: ' LISTMONK_TOKEN
printf '\n'
curl -fsS -H "Authorization: token ${LISTMONK_TOKEN}" http://127.0.0.1:9000/api/config \
  > "$BACKUP_DIR/listmonk-config.before.json"
jq -e '.data.version == "v6.0.0"' "$BACKUP_DIR/listmonk-config.before.json"
curl -fsS -H "Authorization: token ${LISTMONK_TOKEN}" http://127.0.0.1:9000/api/import/subscribers \
  > "$BACKUP_DIR/listmonk-import.before.json"
jq -e '.data.status == "none"' "$BACKUP_DIR/listmonk-import.before.json"
unset LISTMONK_TOKEN

# Freeze Listmonk before evaluating campaign state or capturing any baseline.
docker compose stop listmonk

# Scheduled or running campaigns are a stop condition. Paused campaigns are
# retained data but do not have an active sender.
docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'status', status, 'send_at', send_at) ORDER BY id), '[]'::jsonb) FROM campaigns WHERE status IN ('running', 'scheduled');" \
  | jq -S . > "$BACKUP_DIR/active-campaigns.before.json"
jq -e 'length == 0' "$BACKUP_DIR/active-campaigns.before.json"
```

With both callers stopped, take the final semantic snapshots and database-scoped backups. The Shlink dump is a catastrophe safeguard; the planned migration does not touch it.

```sh
test -z "$(docker compose ps -q --status running yah-admin listmonk)"

# With the only Shlink-writing application stopped, record the complete
# semantic catalog and visit counters. Enter the key without echoing it.
read -rsp 'Shlink API key: ' SHLINK_KEY
printf '\n'
curl -fsS -H "X-Api-Key: ${SHLINK_KEY}" \
  'https://y4h.link/rest/v3/short-urls?itemsPerPage=10000&orderBy=dateCreated-DESC' \
  > "$BACKUP_DIR/shlink-catalog.private.before.json"
unset SHLINK_KEY

jq -e '
  .shortUrls.pagination.totalItems <= 10000 and
  .shortUrls.pagination.totalItems == (.shortUrls.data | length) and
  all(.shortUrls.data[]; .domain == null) and
  all(.shortUrls.data[]; .hasRedirectRules == false) and
  ((["signup", "training", "campus-training", "sign-in", "join", "whatsapp", "donate"] -
    [.shortUrls.data[].shortCode]) | length == 0)
' "$BACKUP_DIR/shlink-catalog.private.before.json"
jq -S '{total: .shortUrls.pagination.totalItems, data: [.shortUrls.data[] | del(.visitsSummary)] | sort_by([.domain, .shortCode])}' \
  "$BACKUP_DIR/shlink-catalog.private.before.json" \
  > "$BACKUP_DIR/shlink-semantic.before.json"
jq -S '[.shortUrls.data[] | {domain, shortCode, visitsSummary}] | sort_by([.domain, .shortCode])' \
  "$BACKUP_DIR/shlink-catalog.private.before.json" \
  > "$BACKUP_DIR/shlink-visits.before.json"

# Snapshot both the canonical host and the seven legacy y4h.org aliases.
for host in y4h.link y4h.org; do
  for slug in signup training campus-training sign-in join whatsapp donate; do
    printf '%s/%s\n' "$host" "$slug"
    curl -fsSI "https://${host}/${slug}" | tr -d '\r' | sed -n '1p;/^location:/Ip'
  done
done > "$BACKUP_DIR/printed-qr-routes.before.txt"

# Capture the exact baseline only after every Listmonk caller is stopped.
docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT jsonb_build_object(
    'subscribers', (SELECT COUNT(*) FROM subscribers),
    'subscriber_lists', (SELECT COUNT(*) FROM subscriber_lists),
    'lists', (SELECT COUNT(*) FROM lists),
    'campaigns', (SELECT COUNT(*) FROM campaigns),
    'campaign_lists', (SELECT COUNT(*) FROM campaign_lists),
    'campaign_media', (SELECT COUNT(*) FROM campaign_media),
    'campaign_views', (SELECT COUNT(*) FROM campaign_views),
    'link_clicks', (SELECT COUNT(*) FROM link_clicks),
    'links', (SELECT COUNT(*) FROM links),
    'bounces', (SELECT COUNT(*) FROM bounces),
    'templates', (SELECT COUNT(*) FROM templates),
    'media', (SELECT COUNT(*) FROM media),
    'roles', (SELECT COUNT(*) FROM roles),
    'sessions', (SELECT COUNT(*) FROM sessions),
    'users', (SELECT COUNT(*) FROM users));" \
  | jq -S . > "$BACKUP_DIR/listmonk-counts.before.json"

# Record full settings and roles privately, then compute exactly the documented
# v6.1/v6.2 changes. Everything else must remain unchanged.
docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COALESCE(jsonb_object_agg(key, value ORDER BY key), '{}'::jsonb) FROM settings;" \
  | jq -S . > "$BACKUP_DIR/listmonk-settings.before.json"
jq -S '
  if has("privacy.disable_tracking") then . else .["privacy.disable_tracking"] = false end |
  if has("bounce.lettermint") then . else .["bounce.lettermint"] = {"enabled": false, "key": ""} end |
  .smtp |= map(. + {
    "msg_retry_delay": (.msg_retry_delay // "10ms"),
    "from_addresses": (.from_addresses // [])
  }) |
  if .["app.lang"] == "cs-cz" then .["app.lang"] = "cs"
  elif .["app.lang"] == "jp" then .["app.lang"] = "ja"
  elif .["app.lang"] == "se" then .["app.lang"] = "sv" else . end |
  .["bounce.azure"] = {
    "enabled": (.["bounce.azure"].enabled // false),
    "shared_secret": (.["bounce.azure"].shared_secret // ""),
    "shared_secret_header": (.["bounce.azure"].shared_secret_header // "")
  } |
  if has("app.show_optin_page") then . else .["app.show_optin_page"] = true end |
  if has("security.cors_origins") and (has("security.trusted_urls") | not)
    then .["security.trusted_urls"] = .["security.cors_origins"] | del(.["security.cors_origins"])
    else . end |
  del(.migrations)
' "$BACKUP_DIR/listmonk-settings.before.json" > "$BACKUP_DIR/listmonk-settings.expected.json"

docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM roles r;" \
  | jq -S . > "$BACKUP_DIR/listmonk-roles.before.json"
jq -S 'map(
  if ((((.permissions | index("campaigns:manage")) != null) or
       ((.permissions | index("campaigns:manage_all")) != null)) and
      ((.permissions | index("campaigns:send")) == null))
  then .permissions += ["campaigns:send"] else . end
)' "$BACKUP_DIR/listmonk-roles.before.json" > "$BACKUP_DIR/listmonk-roles.expected.json"

docker compose exec -T postgres pg_dump -U postgres -d listmonk -Fc > "$BACKUP_DIR/listmonk-v60.dump"
docker compose exec -T postgres pg_dump -U postgres -d shlink -Fc > "$BACKUP_DIR/shlink-untouched.dump"
docker compose exec -T postgres pg_dumpall -U postgres --globals-only > "$BACKUP_DIR/postgres-globals.sql"
docker compose exec -T postgres pg_restore --list < "$BACKUP_DIR/listmonk-v60.dump" > "$BACKUP_DIR/listmonk-v60.dump.list"
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/SHA256SUMS"
```

Copy the restricted directory off the VPS and restore both database dumps into separate disposable PostgreSQL 18 databases. Listing an archive is not a restore test. Compare Listmonk's core counts and last migration marker. Start the exact Shlink v5.0.1 image against the restored Shlink database and require its authenticated semantic manifest to match `shlink-semantic.before.json`. Do not proceed until the off-host copy and both restore tests succeed.

Create a fast, connection-disabled v6.0 clone after the final dump. These commands deliberately connect to the `postgres` database rather than the database being frozen:

```sh
docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE listmonk WITH ALLOW_CONNECTIONS false;"

if ! docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'listmonk' AND pid <> pg_backend_pid();" \
  -c "CREATE DATABASE listmonk_v60_pre_v62 WITH TEMPLATE listmonk OWNER listmonk;"; then
  docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "ALTER DATABASE listmonk WITH ALLOW_CONNECTIONS true;"
  exit 1
fi

docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE listmonk WITH ALLOW_CONNECTIONS true;" \
  -c "ALTER DATABASE listmonk_v60_pre_v62 WITH ALLOW_CONNECTIONS false;"
```

#### Upgrade and acceptance

Run the migration once using the exact Compose target. This is the required step that an ordinary container start does not perform:

```sh
docker compose run --rm --no-deps listmonk \
  ./listmonk --upgrade --yes --config /listmonk/config.toml

test "$(docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT value->>-1 FROM settings WHERE key = 'migrations';")" = 'v6.2.0'
```

Before starting Listmonk, recompute the stable baseline while every caller remains stopped:

```sh
docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT jsonb_build_object(
    'subscribers', (SELECT COUNT(*) FROM subscribers),
    'subscriber_lists', (SELECT COUNT(*) FROM subscriber_lists),
    'lists', (SELECT COUNT(*) FROM lists),
    'campaigns', (SELECT COUNT(*) FROM campaigns),
    'campaign_lists', (SELECT COUNT(*) FROM campaign_lists),
    'campaign_media', (SELECT COUNT(*) FROM campaign_media),
    'campaign_views', (SELECT COUNT(*) FROM campaign_views),
    'link_clicks', (SELECT COUNT(*) FROM link_clicks),
    'links', (SELECT COUNT(*) FROM links),
    'bounces', (SELECT COUNT(*) FROM bounces),
    'templates', (SELECT COUNT(*) FROM templates),
    'media', (SELECT COUNT(*) FROM media),
    'roles', (SELECT COUNT(*) FROM roles),
    'sessions', (SELECT COUNT(*) FROM sessions),
    'users', (SELECT COUNT(*) FROM users));" \
  | jq -S . > "$BACKUP_DIR/listmonk-counts.after.json"
cmp "$BACKUP_DIR/listmonk-counts.before.json" "$BACKUP_DIR/listmonk-counts.after.json"

docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COALESCE(jsonb_object_agg(key, value ORDER BY key), '{}'::jsonb) FROM settings;" \
  | jq -S 'del(.migrations)' > "$BACKUP_DIR/listmonk-settings.after.json"
cmp "$BACKUP_DIR/listmonk-settings.expected.json" "$BACKUP_DIR/listmonk-settings.after.json"

docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM roles r;" \
  | jq -S . > "$BACKUP_DIR/listmonk-roles.after.json"
cmp "$BACKUP_DIR/listmonk-roles.expected.json" "$BACKUP_DIR/listmonk-roles.after.json"

test "$(docker compose exec -T postgres psql -U postgres -d listmonk -Atc \
  "SELECT COUNT(*) FROM users WHERE type = 'api' AND password !~ '^[a-f0-9]{64}$';")" -eq 0
```

The role comparison permits exactly the v6.1 compatibility change: roles that had `campaigns:manage` or `campaigns:manage_all` gain `campaigns:send`; every other role field and permission remains byte-identical. The settings comparison permits exactly the documented v6.1/v6.2 defaults, SMTP field additions, supported locale corrections, CORS-key rename, and migration marker.

Only after those stopped-state comparisons pass, start Listmonk. Authenticate with the existing `username:token` value and require the declared version; the migration changes token storage, while callers continue presenting the original token:

```sh
docker compose up -d --no-deps --pull never --wait listmonk
curl -fsS http://127.0.0.1:9000/health | jq -e '.data == true'

read -rsp 'Listmonk username:token: ' LISTMONK_TOKEN
printf '\n'
curl -fsS -H "Authorization: token ${LISTMONK_TOKEN}" http://127.0.0.1:9000/api/config |
  jq -e '.data.version == "v6.2.0"'
curl -fsS -H "Authorization: token ${LISTMONK_TOKEN}" http://127.0.0.1:9000/api/import/subscribers |
  jq -e '.data.status == "none"'
unset LISTMONK_TOKEN
```

Compare the private authenticated config artifact, SMTP messenger names/enabled states, templates, lists, subscribers, campaigns, bounces, and public lists. Verify a two-campaign analytics query, public subscription-list read, and one disposable private-list create/delete. Send mail only if the designated owner explicitly approves one internal transactional canary. Keep the admin stopped until the Shlink preservation gate below passes.

Repeat the normalized Shlink API and printed-route snapshots into `.after` files, then require:

- the current Shlink `Config.Image` and image ID equal `shlink-image.before.txt`;
- the normalized semantic catalog is byte-identical;
- all seven protected short codes still exist;
- all fourteen canonical/legacy route headers have the same status and destination;
- visit totals have not decreased; and
- no Shlink container restart or database migration occurred.

The semantic manifest comparison already fixes record order and identity. After producing `shlink-visits.after.json` with the same sorted projection used before maintenance, enforce nondecreasing totals componentwise:

```sh
jq -e --slurpfile before "$BACKUP_DIR/shlink-visits.before.json" '
  . as $after |
  $before[0] as $before |
  ($after | length) == ($before | length) and
  all(range(0; $before | length); . as $i |
    $after[$i].domain == $before[$i].domain and
    $after[$i].shortCode == $before[$i].shortCode and
    $after[$i].visitsSummary.total >= $before[$i].visitsSummary.total and
    $after[$i].visitsSummary.nonBots >= $before[$i].visitsSummary.nonBots and
    $after[$i].visitsSummary.bots >= $before[$i].visitsSummary.bots)
' "$BACKUP_DIR/shlink-visits.after.json"

# Reopen the already-existing admin only after every provider gate passes;
# do not reconcile its image or dependencies in this maintenance window.
docker compose start yah-admin
```

Retain both exact Listmonk images, the frozen clone, both restricted dumps, the Shlink manifest, and checksums through the observation window. Do not run automatic image pruning during that window.

#### Rollback

Rollback before reopening writes if the migration, token, version, counts, SMTP/template shape, public read, adapter probes, or Shlink invariants fail. Once production writes have occurred on v6.2, prefer forward repair: swapping to the frozen database discards those later subscribers, analytics, bounces, and campaign changes.

With callers stopped, preserve the failed database and perform this ordered database swap. Each `psql -c` is a separate transaction; this is deliberately not described as atomic:

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

Re-run the v6.0 version/token, data, public route, and every Shlink/printed-QR invariant while the admin remains stopped. Only after those rollback gates pass, reopen the admin and verify its read paths:

```sh
docker compose start yah-admin
```

If the frozen clone is unavailable, restore only `listmonk-v60.dump` into a newly created `listmonk` database; never restore the shared volume or the Shlink dump as part of a Listmonk rollback.

If any rename command fails, keep both callers stopped and inspect `pg_database` before issuing another rename. The intended recovery state is exactly one connection-enabled database named `listmonk` plus a connection-disabled preserved failed database. Never guess from command position or start either application while no database—or the wrong database—is named `listmonk`.

#### Shlink pin maintenance is separate

Production currently runs Shlink v5.0.1 at the exact digest now recorded in Compose. The database inventory contains 16 short links, zero custom domains, and all seven printed-QR codes. QR bitmaps are generated from each provider `shortUrl`; they are not stored in Shlink. Editing a protected destination deliberately preserves the printed identity, clearing visits preserves redirection but destroys analytics, and deletion would break the physical QR.

The current-admin source and admin-v2 block deletion of `signup`, `training`, `campus-training`, `sign-in`, `join`, `whatsapp`, and `donate` in the server command and UI. The previously deployed immutable legacy rollback image predates this barrier; if it is ever restored, operators must treat all seven identities as undeletable. Admin-v2's deliberately simple route model also rejects any non-null Shlink domain or any shortlink with redirect rules; supporting either requires explicit identity/rule modeling rather than silently presenting only the default destination. These are application mistake barriers; the database dump, semantic manifest, and public redirect checks remain the recovery/deployment barrier.

The running Shlink container may still have the old `latest` Compose label even though its image bytes match the pinned v5.0.1 digest. Adopting the new reference requires one recreation. Do that in its own maintenance window. Reacquire `/home/deploy/yah/.production-deploy.lock`, rerun the complete Shlink image/API/printed-route inventory, take a fresh database-scoped dump, copy it off-host, and restore it into disposable PostgreSQL with the exact Shlink image before proceeding. Then pull and verify the immutable Compose target before the one intentional recreation:

```sh
cd /home/deploy/yah/infra
set -euo pipefail
exec 9>/home/deploy/yah/.production-deploy.lock
flock --timeout 900 9

# Stop the only Shlink-writing application before the private baseline and dump.
docker compose stop yah-admin
test -z "$(docker compose ps -q --status running yah-admin)"

docker compose pull shlink
test "$(docker compose config --images | grep '^shlinkio/shlink:')" = \
  'shlinkio/shlink:5.0.1@sha256:a6d8508bc6b0eba5a28e1ee8b64dd5253434cd113c950e715baab4020edcd2a1'
# STOP unless the fresh dump has been restore-tested and the private semantic,
# visit-total, redirect-rule, and fourteen-route snapshots are complete.
docker compose up -d --no-deps --pull never --wait shlink
```

Keep the admin stopped while requiring the exact same image version/digest, semantic catalog, redirect rules, nondecreasing visits, and fourteen printed route destinations afterward. Reopen it only after every comparison succeeds:

```sh
docker compose start yah-admin
```

Do not combine that no-op code pin recreation with Listmonk v6.2 or the admin-v2 cutover.

The selected production architecture is explicit in-place migration plus a custom-format dump and frozen database clone. Auto-upgrade-on-start was rejected because every restart could mutate schema; v6.0/v6.2 binaries sharing one database were rejected because v6.2 hashes tokens; full blue-green databases were kept for rehearsal because live write synchronization adds disproportionate complexity; logical replication/dual writes were rejected for the same reason. For this small single-instance deployment, the chosen path has the fewest moving parts while preserving a fast and independently verified rollback.

## Architecture choice

Use a feature-sliced modular monolith with selective ports/adapters:

```text
apps/admin-v2/src/
  platform/       auth, logging, request/error mechanics
  integrations/   Listmonk, Shlink, Umami protocols
  features/       campaign, subscriber, list, role, member slices
  ui/             reusable presentation primitives
```

Introduce `packages/admin-core` only when `apps/admin-v2` exists, and put only framework-neutral schemas, capabilities, invitation decisions, and pure generators there.

Alternatives considered:

| Architecture                      | Advantages                                            | Costs / decision                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current horizontal folders        | Familiar and low immediate churn.                     | Already encourages large integration files, contract duplication, and permission drift. Migrate incrementally away from it.                      |
| Full hexagonal/clean architecture | Strong isolation and replaceability.                  | Too much interface/repository/command-bus ceremony for this internal admin. Apply boundary discipline only to external systems and durable work. |
| Separate SPA and API              | Framework-independent backend and reusable API.       | Adds CORS/CSRF, a second deployment, explicit RPC/versioning, and duplicate auth wiring. Revisit only when another client needs the API.         |
| TanStack full-stack target        | Strong routing/search typing and cache orchestration. | Changes router, cache model, generator, and framework together while Solid 2 adapters are moving. Reject for this migration.                     |
| Remain indefinitely on Solid 1    | Lowest short-term risk.                               | Does not meet the migration goal. Keep the existing app as rollback until the new target proves parity.                                          |

Do not build generic repositories, a command bus, or a generic CRUD engine. Add interfaces only at external boundaries or where deterministic tests need injection.

## Library decisions

| Timing                           | Choice                                           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep                             | Valibot                                          | Framework-neutral runtime contracts already in use; replacing it with Zod adds churn without capability.                                                                                                                                                                                                                                                                                                                                                        |
| Keep                             | Better Auth 1.6.30 organization RBAC             | Already owns sessions, invitation-bound magic links, memberships, and dynamic roles. Both applications use an exact shared pin; the current admin adds one narrow policy hook around generic endpoints, and the Solid 2 app consumes the framework-neutral client rather than the Solid 1 adapter. CASL/Casbin/Cerbos/Oso would duplicate policy unless resource-level ABAC or cross-service policy becomes real. Defer 1.7.1's manual issuer migration.        |
| Keep                             | Native fetch wrapper                             | Small, tested, migration-safe, and explicit about retries. Ky offers conveniences but little marginal value now. Add response schemas as integration contracts are split.                                                                                                                                                                                                                                                                                       |
| Keep                             | Lexical                                          | Framework-neutral core and no product justification for a TipTap/ProseMirror migration. The Solid 2 route now proves typed lifecycle ownership, controlled HTML, formatting, disablement, cleanup, and route-level code splitting.                                                                                                                                                                                                                              |
| Keep                             | Kobalte and TanStack Table v8 in the current app | Replacing accessible primitives or table behavior during stabilization increases risk. Compatibility must be proven in the Solid 2 laboratory.                                                                                                                                                                                                                                                                                                                  |
| Keep for now                     | Local form store                                 | Modular Forms is maintenance-only; Formisch's Solid adapter and TanStack Form's Solid 2 support are not ready enough to justify a rewrite.                                                                                                                                                                                                                                                                                                                      |
| Add before migration             | Playwright                                       | One framework-independent parity suite can run against both admin versions. Cover login, all invitation states, built-in and dynamic roles, direct loads, authorization failures, and session expiry.                                                                                                                                                                                                                                                           |
| Add after smoke tests            | `@axe-core/playwright`                           | Broad automated accessibility regression coverage, followed by keyboard/manual review.                                                                                                                                                                                                                                                                                                                                                                          |
| Added                            | Local toast facade                               | Seventeen direct `solid-sonner` imports now collapse behind an app-owned boundary, enforced by ESLint, so a framework swap is localized.                                                                                                                                                                                                                                                                                                                        |
| Added to current admin only      | `p-limit`                                        | The rollback app's per-campaign analytics fan-out deduplicates IDs and runs at concurrency eight instead of creating a 500-request burst. Admin-v2 deliberately does not carry this dependency: after the required Listmonk v6.2 upgrade, its corrected repeated-ID endpoint needs one request per metric. It is not a durable queue.                                                                                                                                                                                          |
| Add when logging phase starts    | Pino, server-only                                | Structured JSON, correlation bindings, and redaction fit Docker stdout. Do not add full OpenTelemetry until a collector/backend exists; retain direct `@opentelemetry/api` because Better Auth requires the peer.                                                                                                                                                                                                                                               |
| Add only if durable work emerges | `pg-boss`                                        | Appropriate with existing PostgreSQL when jobs must survive restarts or exceed request lifetimes.                                                                                                                                                                                                                                                                                                                                                               |
| Do not add now                   | TanStack Query                                   | Router queries already own loading/cache/invalidation. Add only for demonstrated polling, optimistic updates, cross-route reuse, or stale-data policy.                                                                                                                                                                                                                                                                                                          |
| Do not add                       | ORM                                              | The app has little owned persistence outside Better Auth; another schema/migration abstraction would not improve the current boundaries.                                                                                                                                                                                                                                                                                                                        |
| Introduce incrementally          | CSS Modules                                      | Native Vite support; scope feature/component CSS while keeping tokens and app layout global. No styling library is needed.                                                                                                                                                                                                                                                                                                                                      |
| Keep for Solid 2                 | `srvx`                                           | Its Fetch adapter removes a hand-written Node/Bun bridge. Static serving is now owned by the deployment entry and enabled only in explicit lab mode, because CLI static precedence otherwise bypasses application middleware. Lab and production-mode built-server tests cover bodies, streaming, distinct cookies, assets, API/server-function dispatch, and the fail-closed boundary.                                                                         |
| Remove for Solid 2               | `@tanstack/solid-table` / `@tanstack/table-core` | Both installed v8 and published v9 Solid adapters use removed Solid 1 runtime APIs. A narrow v8 core bridge proved possible, then was removed because the remaining small inventories do not justify its dependency, adapter, tests, lab route, or client weight. Use semantic tables and provider order now. Reconsider an official Solid 2 adapter only after a real workflow needs at least two substantial table capabilities; prefer URL-backed provider search/order/pagination when scale alone is the problem. AG Grid remains disproportionate. |
| Replace for Solid 2              | `solid-sonner` and `lucide-solid`                | Neither has a compatible published Solid 2 build. The toast facade already localizes Sonner; icons have only two import sites and should move behind a local icon module or a framework-neutral icon-data renderer.                                                                                                                                                                                                                                             |
| Wait or replace for Solid 2      | Kobalte                                          | Kobalte 2 alpha pins Solid/Web RC.0 exactly, while the official target uses RC.2. Current Ark UI is developed on Solid 1.9 and its Zag adapter imports `mergeProps` from `solid-js`, which Solid 2 no longer exports; Corvu also peers on Solid 1. Do not use Zag directly, trust broad peer ranges, peer-override these packages, or own bindings for complex focus-managed primitives. Retest a release explicitly verified against the same Solid 2 version. |
| Adopt only for a concrete seam   | Solid Primitives `next` packages                 | The Solid 2 lines peer on `^2.0.0-rc.0`, but utilities are not a design system. Add one only when it deletes demonstrated browser-lifecycle code; blanket adoption would fragment otherwise simple native behavior.                                                                                                                                                                                                                                            |
| Wait                             | Formisch                                         | It is the best future form candidate because it is Valibot-native, but `@formisch/solid@1.0.0` explicitly excludes Solid 2. Current forms are small and domain-specific, so a form-state rewrite has little payoff even after compatibility arrives. Modular Forms is maintenance-only and TanStack Form adds a store without a current requirement.                                                                                                               |
| Do not add during this migration | Ark UI, Zag, Corvu, Park UI/Panda                 | Ark's Solid 2 work is deferred to v6; direct Zag still carries a Solid 1 primitive dependency; Corvu has no official Solid 2 line; Park inherits Ark and adds code generation plus another color system. These headless systems would not solve the app's spacing/color duplication, while a styled-kit migration would replace the visual language during the framework cutover.                                                                                  |
| Use as a pattern source          | [Oat](https://oat.ink/)                           | Its semantic CSS and warm native-control treatment are the closest visual match, but its broad element/reset selectors would compete with the app-owned shell and its JavaScript custom elements assume browser globals and mutate light DOM owned by Solid. Do not import the complete CSS or JS runtime. Adapt only a measured form, table, or progress pattern behind `--admin-*` tokens; a safe CSS-only pass may remove roughly 250–400 lines without changing behavior ownership. |
| Fallback dependency, if measured | [Pico CSS](https://picocss.com/)                  | Pico is the most credible mature off-the-shelf CSS option because its Sass modules, variable prefix, and [conditional mode](https://picocss.com/docs/conditional) can scope a small build beneath `.admin-layout-v2`. It would still replace a working visual layer for only modest source reduction, so add it only after a bounded pilot beats the current CSS on payload, collisions, and maintenance. |
| Selective tokens only           | [Open Props](https://open-props.style/)           | Individual spacing, easing, shadow, or color packs can sit behind the public `--admin-*` token contract. The global normalize is unnecessary, and token substitution alone is unlikely to reduce meaningful application code. |
| Add only for a hard widget       | [Web Awesome](https://webawesome.com/docs/)       | Its Lit/Web Components have strong isolation and accessibility coverage, but bring a substantial runtime/design-system graph. Deep-import a component only when a genuinely difficult combobox, tree, or similar focus-managed widget would otherwise require significant custom behavior; do not use it for native buttons, forms, tables, dialogs, or toasts. |
| Do not adopt                    | missing.css, Kelp, global classless/UI kits       | missing.css is broader and more content-oriented than this shell; Kelp requires separate legal review for its custom license; Simple/MVP/Water/Pure and large styled systems either assume document-wide control, are dormant, or are disproportionate. Bootstrap, Bulma, and Tailwind retrofits would create more class/design churn than consolidation. |
| Revisit only if charts grow      | Observable Plot                                  | Current CSS bars and semantic tables keep every value readable and need no lifecycle wrapper. Observable Plot is the first framework-neutral candidate if real axes, time series, faceting, or tooltips become requirements; AG Charts is reserved for substantially larger interactive datasets.                                                                                                                                                              |
| Keep for Solid 2                 | `qr-code-styling`                                | Framework-neutral, typed, and retains the existing styled SVG/PNG behavior. The lab proves async import, reactive SVG updates, and teardown. A plain QR encoder would reduce bundle size but remove the product's style/logo/download surface.                                                                                                                                                                                                                  |

The table decision was superseded on 2026-08-27 after campaign and shortlink parity made the real interaction surface measurable. Keeping the bridge preserved local conveniences but owned an unstable framework seam and shipped roughly 49 kB raw of shared table code on `/shortlinks`; recreating the same features with local signals would remove the package but not the product complexity. Native static tables with provider-defined order are the smallest current design. If operators later struggle to locate records, add server search with URL state; if transfer/rendering becomes slow, add provider pagination before the completeness cap; expose ordering only for a demonstrated workflow. Official Solid 2 support is necessary but not sufficient reason to re-add TanStack Table.

The stabilization cleanup applies that decision consistently: Templates, Mailing Lists, and Roles no longer carry client-only filter state for their small complete inventories. Subscriber search remains because it is a bounded provider query encoded in the URL, not a filter over one fetched page. Campaign analytics retains URL-owned metric/date selection because those controls define the provider request rather than rearranging a local table.

The visual-system choice is native-first and app-owned: semantic surface, border, text, action, status, and focus tokens live globally; protected-layout controls, page headers, breadcrumbs, form actions, table frames, and buttons are shared CSS primitives; feature CSS owns only feature-specific composition. Headless libraries can later replace difficult behavior behind the existing toast/dialog seams, but they do not own brand styling. This avoids both a one-off CSS free-for-all and a styled-kit rewrite during Solid 2 migration.

Toolchain correction: TypeScript 6 was outside the installed `@typescript-eslint` peer range, and ESLint 10 was outside `eslint-plugin-solid` support. The current app is pinned to TypeScript 5.9 and ESLint 9.

## Phase 2: Solid 2 compatibility and migration

The official migration direction is a parallel application. Released SolidStart 2 still runs Solid 1, so the Solid 2 target removes `@solidjs/start` and uses `@solidjs/vite-plugin` start mode directly. Solid 2 is currently RC with a frozen API but expected remaining bugs; the parallel app is now a production candidate, while actual cutover remains gated on the provider maintenance and deployment checks below.

The baseline is the official full-stack template at [`ca15101e`](https://github.com/solidjs/templates/tree/ca15101e69e4bbf8727de6878db2bd5718b6b42f/solid-v2/fullstack), not the older beta/local-package snapshot linked from the migration guide. The lab pins Solid/Web `2.0.0-rc.2`, Router `2.0.0-next.17`, Vite plugin `3.0.0-next.33`, `filesystem-routing` `0.2.1`, Vite 8, and Node `>=22.12`. Router `next.17` replaced `next.16` after the latter passed a route module URL in Solid's former second `lazy()` argument and failed at runtime under RC.2; the router release moves it to the required third argument. References: [Solid 2 RC announcement](https://www.solidjs.com/blog/solid-2-0-rc-the-big-reveal), [SolidStart migration](https://v2.solidjs.com/migration/from-solid-start), [start mode](https://v2.solidjs.com/reference/vite-plugin-solid/start), and [Router `2.0.0-next.17`](https://github.com/solidjs/solid-router/releases/tag/%40solidjs%2Frouter%402.0.0-next.17).

- [x] Add the first framework-independent Playwright parity harness to the current admin; authenticated invitation and role matrices remain gated on deterministic seeded services.
- [x] Add a local toast facade and prevent direct adapter imports.
- [ ] Add broader client/server import restrictions after feature boundaries exist; do not encode the current horizontal layout as permanent policy.
- [x] Scaffold `apps/admin-v2` from the exact recorded official full-stack template revision, retaining only packages and template features the admin needs.
- [x] Prove the Solid 2 platform baseline: CSR document generation, root `Loading`, Router 2 filesystem routes, typed client/server env, one query, one strict typed action, API GET/HEAD, middleware, production build, and a real browser run with no Solid warnings.
- [x] Prove the `srvx` adapter across conditional static files, request bodies, incremental streaming, separate cookies, API routes, and a real `POST /_server`. A second built server proves the fail-closed deployment mode exposes only health while the unfinished UI, assets, probes, auth, and server functions remain closed. With the pinned Vite plugin `next.33`, `vite preview` serves the CSR document/assets but falls back to that document for `/api/*` and `/_server`; use the built Fetch handler for server-backed parity and retest preview on plugin upgrades.
- [x] Evaluate and prove a narrow `@tanstack/table-core` v8 adapter, then remove it and the direct dependency after simplifying the remaining list surfaces; defer Table v9 until both official Solid 2 support and a demonstrated multi-capability table requirement exist.
- [x] Replace Solid-bound icon and toast packages in the lab with a typed renderer over framework-neutral Lucide node data and an app-owned facade matching the admin's success/error-only toast surface.
- [x] Prove typed Solid 2 lifecycle adapters for framework-neutral Lexical and `qr-code-styling`, including controlled updates, disablement, formatting, async creation, reactive SVG updates, and teardown.
- [x] Prove Better Auth 1.6.30's framework-neutral client and explicit GET/POST handlers against the built server. The lab covers session creation/lookup/deletion, cookie attributes, hostile/null/missing origins, every unsupported method, network-safe UI states, and retry-safe accounts without importing the Solid 1 adapter. This is HTTP compatibility, not PostgreSQL/organization parity.
- [ ] Retest accessible primitives when Kobalte, Ark/Zag, or another maintained package explicitly supports the pinned Solid 2 runtime; do not block platform/auth work on that external release.
- [x] Extract the narrow `packages/admin-core` boundary now that both applications consume the canonical organization/lock constants, invitation policy/path, RBAC statements, and pure role-permission helpers. Keep runtime, request, database, and provider code application-owned.
- [x] Port the production platform slice: all fifteen production environment values, PostgreSQL Better Auth, invitation-only policy, advisory-locked startup maintenance, canonical session/authorization, safe errors, shared HTTP behavior, and the narrow transactional-mail capability required by auth.
- [x] Port the first production product slice: root theme/toasts/loading/error handling, `(auth)` login/forgot/reset routes, an authorization-gated `(app)` shell and minimal dashboard, and the mixed-access invitation route with independent server authorization. Keep the full navigation and feature links out until their owning slices move.
- [x] Port analytics as the first provider-owned feature slice: canonical `analytics:view` authorization, a narrow validated Umami reader, period selection, normalized route DTOs, accessible data presentation, deterministic upstream/browser coverage, and no unrelated dashboard or Shlink coupling.
- [x] Port shortlinks and complete the dashboard as one Shlink-owned vertical slice: typed CRUD commands, permission-specific route reads, normalized Shlink DTOs, QR output, a native provider-ordered inventory, independent dashboard provider panels, and deterministic mutation/browser coverage.
- [x] Port roles and membership as one access-management slice: immutable/product-only custom roles, route-based editors, multi-role membership/invitations, membership-only removal, database-backed role integrity, and a default-private public organization API.
- [x] Port the remaining Listmonk capabilities with their owning feature slices rather than copying the current horizontal integration module wholesale.
  - [x] Email-template inventory, create/edit, provider previews, default selection, and single-record deletion.
  - [x] Lists and subscription-form administration.
  - [x] Subscribers and subscriber activity.
  - [x] Campaign authoring, preview, status lifecycle, native opt-in campaigns, and bounded bulk draft deletion.
  - [x] Bounce inventory plus subscriber-scoped bounce history and clearing.
  - [x] Campaign email analytics with bounded multi-campaign reads and native URL-owned filters.
  - [x] Corrected subscriber-resolved single-recipient campaign test-send; implementation, aggregate verification, and independent phase review pass.
  - [x] Keep import, media, and placeholder operations omitted. After the parity review demonstrated operator requirements, port General/recipient pages, SMTP delivery, delivery policy, v6.2 bounce processing, privacy policy, read-only provider invariants, and redacted process logs behind narrow feature-owned boundaries; do not copy the generic security/storage/code/database settings surface.
- [x] Port one complete feature slice at a time and run the same parity suite against both base URLs.
- [x] Replace Nitro `.output` with the verified Solid 2 Start-mode Fetch output and `srvx` production entry after preview/built-server parity.
- [x] Preserve GHCR builds, non-root runtime, port 3002, image-tag rollback, runtime environment injection, and DB-aware post-deploy health verification.
- [ ] Before admin-v2 cutover, take and restore-test the final production Listmonk backup, run the explicit v6.0.0-to-v6.2.0 maintenance procedure, and verify production authenticated `/api/config`. The disposable upgrade rehearsal and exact digest pin are complete.
- [ ] Cut over only after routes, roles, invitations, auth API, direct loads, session expiry, and deployment all match.
- [ ] Request an independent review after each completed migration phase; advance with no unresolved correctness, security, boundary, or dependency findings.

Production-image candidate verification on 2026-08-27:

- `apps/admin/Dockerfile` now builds `apps/admin-v2`, preserves the three audited auth maintenance executables, injects no production credentials at build time, and boots the Start-mode Fetch entry through `srvx`. Vite owns the self-contained server graph; only the 276 kB `srvx` package is copied beside it, avoiding a fragile second bundler pass over production auth's top-level `await`.
- The Solid 2 native compiler failed under the Alpine builder's WASI fallback (`initialize is not a function`). The official Bun 1.3.11 Debian builder selects the supported glibc binary; the non-root Bun 1.3.11 Alpine runtime remains. This is a build-stage compatibility choice, not a runtime libc dependency.
- The exact Dockerfile completed a clean local image build as `yah-admin-v2-cutover:test`. Its configured user is `yah-admin`, command is `bun server.mjs`, runtime mode defaults to `production`, and an isolated compatibility-mode container returned `{"app":"yah-admin-v2","status":"ok"}` from `/api/health`. The same minimal artifact served the compiled login document/assets outside Docker before the image test.
- Automatic app deploys pull one requested commit-SHA image and use `--no-deps --pull never --wait`; automatic infra deploys target only Caddy. App, provider, and PostgreSQL containers cannot be implicitly reconciled to a mutable Compose default. Image pruning is removed during the rollback-sensitive phase, and the host/GitHub locks serialize deployment. Source-only Compose validation passes and resolves the exact Shlink 5.0.1 and Listmonk 6.2.0 digests.

Solid 2 compatibility-lab verification on 2026-08-25, after independent dependency/auth review:

- `bun run check`: pass.
- Solid 2-aware `bun run lint`: pass.
- `bun run test`: seventeen contract, boundary, adapter, and lifecycle tests pass across six files.
- `bun run build`: pass, producing `dist/client` and the server-function/API handler at `dist/server/server.js` while keeping `ssr: false`.
- `bun run test:e2e`: sixteen tests pass in Chromium against a fresh build and two non-reused `srvx` processes. They cover the CSR shell with no framework warnings, the root loading/settled states, retry after a transient route-query failure, platform-disabled paths, API GET/HEAD and unsupported methods, incrementally streamed chunks, distinct/session cookies, request bodies, conditional static serving, origin rejection, a typed single-flight server-function mutation and rendered result, a safe negative validation path, non-enumerating password-reset announcement, the client catch-all, table behavior, accessible SVG rendering, toast behavior, Lexical/QR lifecycle behavior, and generic Better Auth session lifecycle.

The lazy content route keeps Lexical and QR out of the initial admin shell, and the client output contains no Solid 1 adapter imports. The current Solid 1 build ships the same Lexical modules as several chunks totalling more raw code, so a different editor engine is not justified by this migration. The campaign slice now exposes and browser-verifies Bold, Italic, Underline, Strikethrough, H1–H3, ordered/unordered lists, block quotes, and selection-preserving safe `http`/`https`/`mailto` links. The QR slice owns its preset, selected-color logo, preview, and download behavior separately.

Template deviations are intentional: `@solidjs/meta` and `@remix-run/cookie` were omitted because the current admin uses neither route metadata nor a second session owner; Better Auth is the sole session owner in both lab and production composition. The initial lab env was deliberately minimal; the production platform now validates all fifteen current values without exposing them to the client.

The compatibility auth server is intentionally in-memory, has no organization plugin, and is disabled unless `ADMIN_V2_RUNTIME=compatibility-lab` plus an explicit server-only lab secret are present. The default `platform-disabled` mode runs no static middleware and rejects everything except `/api/health`. Explicit `production` mode now exposes database-aware health, the real GET/POST Better Auth API, immutable assets, and only the completed auth/dashboard/invitation pages plus the shared server-function transport. Compatibility documents and probes remain HTTP-closed; every compatibility function also rejects production at invocation time. Rate limiting is disabled only inside the isolated lab because its local `srvx` request lacks a trusted client-IP chain; production retains the Caddy-replaced `x-forwarded-for` contract.

Production-platform verification on 2026-08-26:

- `virtual:env/server` declares the complete fifteen-value production contract as optional at the shared build boundary, then a server-only production module synchronously requires every value, normalizes origins and identifiers, and preserves opaque credentials byte-for-byte. The default runtime value was deliberately renamed to the distinctive `platform-disabled` so Start Mode's server-value leak detector does not confuse a common UI string with a leaked secret; the detector remains enabled and the production build passes.
- Better Auth remains exactly 1.6.30 with PostgreSQL 8.20 types/runtime, disabled password signup and organization creation, required verification, password-reset session revocation, invitation-bound hashed magic links, dynamic roles, rate limiting, and explicit framework-neutral Fetch handlers. The server eagerly validates configuration, runs migrations and unverified-session cleanup under the shared advisory transaction lock, and resolves exactly one canonical `yah` organization before listening.
- One canonical-session resolver now owns verified-session, exact-active-organization, and explicit-membership checks. UI projection unions built-in and dynamic multi-role permissions for discoverability, while every command authorization still calls Better Auth `hasPermission` with the canonical organization ID. A future route query captures `getRequestEvent()?.request` before its first `await` and dynamically imports production-only authorization so Start Mode's eager server-function manifest cannot initialize production auth in lab builds.
- The shared package extraction was intentionally limited to already-dual-consumed security facts and pure helpers. An alternative was temporary duplication until a feature slice existed; it avoided workspace/Docker churn but would leave roughly 300 lines of invitation/RBAC policy able to drift between two live auth configurations. Environment composition, Better Auth construction, lifecycle, request/error adapters, providers, UI, and deployment remain separate.
- The test configuration now follows the pinned Vite plugin's documented client/server projects: jsdom for UI/contracts and Node/server export conditions for platform/integration tests. V2 unit verification passes 40 tests across twelve files, the shared package passes nine invitation-state tests, and the three guarded PostgreSQL auth tests are skipped in ordinary local runs but required by CI against a disposable `_test` database.
- A built `srvx` production process against disposable PostgreSQL passed GET/HEAD database readiness, real unchanged-password login, canonical-organization activation, session continuity, signup closure, hostile-origin rejection, organization-creation closure, GET/POST-only auth handling, and 404s for the unfinished UI, compatibility routes, and `/_server`.
- Three opt-in PostgreSQL tests passed for multi-role plus dynamic-role projection, Better Auth-backed allowed/denied permissions, verified nonmember rejection, and unverified password-login rejection. Their users, accounts, memberships, dynamic role, and sessions were self-cleaned.
- A second built process was observed waiting with `wait_event_type=Lock` / `wait_event=advisory` while another transaction held lock `941741`; it did not log its listening address until the lock was released. Startup removed an injected unverified session but preserved its user row, after which the explicit fixture and all three temporary app containers were removed. The disposable database returned to zero fixture rows and sessions.
- The full sixteen-test Chromium compatibility suite passed again after the first product slice, so CSR, root loading and error recovery, Start Mode dispatch, adapters, content lifecycles, and the isolated lab auth did not regress. The current admin image rebuilt successfully from the exact Bun 1.3.11 base with the shared package as `yah-admin-review:local` (`sha256:6b5204bb5b56…`), and the unrelated web image also rebuilt successfully as `yah-web-review:local` (`sha256:3ff05809d57f…`).

First production product-slice verification on 2026-08-26:

- The route architecture is one filesystem router with pathless `(auth)` and `(app)` boundaries plus `/members/accept/:id` outside both. Guest routes redirect only canonical-authorized sessions; the protected group consumes `requireSession`; the invitation page preloads its non-disclosing state and optional session but reauthorizes every mutation. Router queries remain the sole session cache.
- The UI keeps CSR and the root `Loading` boundary for migration parity. A second protected-outlet boundary preserves the authenticated chrome during feature loading, while root and route error views reveal only marked-safe messages. The client title is the runtime-neutral `YAH Admin`; compatibility labeling belongs to `/compatibility`, not the shared document.
- Native controls and signals are sufficient for these small forms. No form library, auth store, TanStack Query, dependency-injection framework, Kobalte/Zag peer override, or hand-built focus-management abstraction was added. `@fontsource-variable/rubik` is the only product UI dependency added in this slice.
- The pure invitation state decision moved to `@yah/admin-core/invitation-state`; both admins consume the same matrix without sharing UI, SQL, request adapters, or runtime composition. The Solid 2 route uses Router 2's `defineFileRoute` witness so the invitation ID is typed and cannot fall through to an empty string.
- A fresh built production process against the explicitly disposable `yah_admin_v2_routes_test` PostgreSQL database passed five serialized browser tests: anonymous root redirect, missing-token reset state, invalid and valid owner login, canonical organization activation, authorized `/login` redirect without a form flash, direct dashboard load, logout/session cleanup, decoded SVG plus assets and method allowlists, compatibility/probe 404s, and replay of a real compatibility server-function request into production. A self-cleaning live-invitation fixture additionally proves anonymous response/DOM redaction, canceled state, wrong-account sign-out without losing the invitation URL, matching verified credential acceptance, durable membership/status/active-organization state, Dashboard access, the accepted terminal state, and non-restoration after membership removal. Fixture mutation requires both an exact confirmation phrase and a database name ending in `_test`; the shared validator runs while Playwright evaluates its config, before either built server can spawn, and teardown removes only sessions created beyond its owner-session snapshot. The mailbox-link/password-setup branch remains covered by the shared Better Auth policy integration rather than this browser fixture and is still part of the deterministic-mail cutover matrix. Solid's server-function transport encodes the runtime-gated safe `Not found` error inside a successful transport envelope, so the isolation test asserts the error payload and absence of the submitted label rather than inventing HTTP semantics the protocol does not provide.
- The production fixture ended with exactly one bootstrap user, one canonical organization/member, zero sessions, and zero invitations. The local relay and database were test-only; CI uses the PostgreSQL service directly and now runs the same built production Playwright gate after the guarded auth integration suite.

Analytics feature-slice verification on 2026-08-26:

- The old dashboard was deliberately not migrated as one unit: its landing query combines Shlink and Umami, and its recent-link rows navigate to unported shortlink detail pages. The selected vertical slice is `/analytics`, a coherent read-only capability with one `analytics:view` permission and one provider. The dashboard remains a truthful placeholder until its Shlink-owned portion moves with shortlinks.
- History in `0daa0f3` explains the process-wide in-flight Umami login promise: nine concurrent analytics reads must not produce an authentication burst when the cached token expires. The Solid 2 reader keeps that single flight, five-minute early JWT expiry, 23-hour fallback, used-token-only invalidation, and exactly one 401 retry. History in `17d7955` removed misleading table filters; the new read-only metric tables therefore have no fake interaction.
- The integration is a feature-specific factory closure, not a generic repository or copied horizontal client. Private Valibot schemas validate authentication, stats, pageviews, metrics, and active-visitor payloads; only normalized analytics DTOs cross into route/UI code. The route captures the request before awaiting, independently gates production runtime, validates the period, and delegates server authority to Better Auth before provider access. Projected permissions only control navigation discoverability.
- Native radio inputs, definition lists, captioned tables with scoped headers, visible value lists, and decorative bars replace the old ToggleGroup, TanStack table wrapper, and tooltip-only chart. No chart, table, query/cache, date, form, retry, or dependency-injection package was added. Router queries remain the cache. A chart package would add weight without improving this fixed bar/value view; a table package requires a measured multi-capability workflow, not merely tabular data; Zag/Kobalte remains deferred until a release matches the pinned Solid 2 runtime.
- Alternatives considered: the whole dashboard was rejected because it crosses two providers and advertises absent routes; a Shlink-only landing adapter was deferred to the shortlinks slice; members/roles was deferred because history shows it is one coupled access-management release with mutation, dialog, dynamic-role, and invitation semantics. When that slice begins, implement role catalog/roles before members but expose both together, remove unjustified bulk role deletion, and prefer semantic checkbox fieldsets or route-based editors over peer-overridden focus libraries.
- Unit coverage now has 53 active passing tests across fourteen files plus three guarded PostgreSQL tests. Analytics tests prove exact paths/ranges/units/limits, normalized DTOs, zero-visit math, shared login under concurrent snapshots, replacement-token preservation after a late stale 401, one retry only, invalid content/DTO rejection, credential/body redaction, invalid-period short-circuiting, and provider non-invocation after denied authorization.
- The exact Bun 1.3.11 type-check and Solid 2 lint pass, as does the guarded production build. The production Playwright launcher accepts only a plain executable path override so local tests cannot silently fall back to an older Bun; CI still uses the pinned setup action binary.
- Seven serialized built-production browser tests pass against disposable PostgreSQL and a native deterministic Umami fixture. They prove permission-discoverable navigation, direct `/analytics`, native keyboard selection across 24-hour/7-day/30-day ranges, semantic group/figure/table structures, visible deterministic data, a forced 502 whose diagnostic stays out of the client, and successful retry. A canonical custom-role user without `analytics:view` separately proves hidden navigation, Better Auth `success:false`, and no rendered provider data on direct access. Existing auth, invitation, asset/method allowlist, and compatibility-replay regressions continue to pass. The full sixteen-test compatibility-lab browser suite also passes after this slice.

Shortlinks and dashboard feature-slice verification on 2026-08-26:

- History across `c10fa14`, `3fdce2b`, `1dcd2c1`, `f46448a`, `dbae02e`, `2541c0a`, `804a07f`, `eb7d93a`, `fb5e9f2`, `b144d8a`, `17d7955`, `0daa0f3`, `1c0df18`, and `edc5422` supports preserving permission-specific actions, typed commands, the complete view-authorized detail data, and configurable/downloadable QR output. It does not justify carrying forward bulk deletion, the locked-overlay editor, or table machinery on read-only dashboard rows. The port therefore uses list/new/detail/edit routes, per-record destructive confirmations, and a native list in Shlink's explicit newest-first order. Local filtering/sorting were removed after parity because they are conveniences rather than domain behavior; Shlink-backed URL search/order/pagination is the cleaner future design if inventory proves it necessary.
- The Shlink integration is a narrow feature adapter with private Valibot response schemas and normalized DTOs. It owns exact API paths, offset-bearing ISO expiry values, allowlisted Problem Details classification, non-bot visit reads, mutation encoding, and a deliberate 10,000-item completeness cap; it refuses a partial list rather than presenting truncated data as complete. A real `400` `non-unique-slug` response becomes one stable conflict result without transporting provider diagnostics. Feature services validate before authorization/provider access and select the exact `view`, `create`, `edit`, or `delete` permission. The edit route receives only an `EditableShortlink` projection and performs no visits request, so an independently granted `edit` capability cannot disclose view-only telemetry.
- Management URLs put provider codes behind a versioned UTF-8 hex route segment and explicit `/details` or `/edit` suffix. The route codec does not depend on Router 2's mixed `decodeURI` behavior, avoids collisions with the static `/shortlinks/new` route and browser dot-segment normalization, and round-trips reserved characters, literal percent escapes, and Unicode. Invalid, noncanonical, and malformed UTF-8 segments fail closed. Create/edit-only users return to the dashboard rather than being redirected or breadcrumbed into view-authorized routes.
- The dashboard composes Shlink- and Umami-owned overview queries under independent error boundaries; no dashboard feature service duplicates either domain's authorization or DTO. One provider can fail and retry without blanking the other panel. The Umami overview performs only the two stat requests it needs; the Shlink overview returns a small purpose-built DTO. Router queries remain the cache and revalidation owner.
- Route-based forms, native inputs, comma-separated tag entry, a shared native `<dialog>` confirmation component with component-owned styles, the existing app toast facade, and the framework-neutral QR adapter cover the interaction surface. QR parity includes color presets, dot/corner styles, optional logo, and SVG/PNG downloads. No form, query/cache, HTTP, dialog, chart, concurrency, table, or dependency-injection package was added. Ky and TanStack Query would duplicate narrow existing boundaries; a form library adds little for two small editors; Zag/Kobalte remains incompatible with the pinned Solid 2 RC; Table v9 remains deferred because its published Solid adapter still consumes Solid 1 internals and no current product requirement justifies a framework-neutral bridge.
- Alternatives rejected for this slice were one page with modal create/edit state, a generic CRUD repository, dashboard aggregation through one server function, parallel per-link reads, and bulk deletion. Route editors make direct loads and browser history explicit; narrow ports keep provider details out of UI code; independent dashboard queries preserve partial availability; the Shlink list endpoint already returns the required summaries; and bulk deletion adds selection/destructive-state complexity without a demonstrated operational need.
- Production-browser work exposed three Solid 2/browser boundary defects that unit tests could not: absent optional command fields must be omitted instead of serialized as `undefined`; data-dependent children must be constructed only after their suspending Start Mode query settles; and reusable native dialogs need per-instance label/description IDs. The implementation now encodes all three invariants, including one edit-authorized query and a settled-data editor child.
- The exact Bun 1.3.11 type-check and lint pass, as do the repository-wide Turbo check/lint/test gates. At slice completion, unit coverage was 89 active tests across eighteen files plus three guarded PostgreSQL tests and nine serialized built-production browser tests passed against disposable PostgreSQL and mutable deterministic Shlink/Umami fixtures. Current regression coverage preserves the real duplicate contract, create/detail/edit/reset/delete, QR configuration and both downloads, a non-UTC expiry round trip, a nonzero visit reset with revalidation, provider-defined newest-first ordering, the reserved code `new`, a literal `%2F` code, independently usable create/edit capabilities without view access, both directions of dashboard partial failure/retry, auth, invitations, and transport isolation. The production fixture self-cleans to one bootstrap user, one canonical organization/member, zero sessions, invitations, and dynamic roles. A production client-bundle scan found no configured provider credentials or fixture diagnostics.

Access-management feature-slice verification on 2026-08-26:

- History in `feb1288` shows dynamic roles replaced a static role table, but does not establish bulk deletion as a product requirement. History in `6718559` and `a0636cd` explains global account deletion as a single-organization shortcut rather than a membership invariant. The port therefore keeps role keys immutable, removes bulk/physical role deletion from both admins, and makes ordinary member removal delete only the organization membership. Both the Solid 2 app and the rollback app resolve the target server-side, reject self-role changes/removal, and require `ac:read` for owner/custom-role assignment or target mutation.
- Custom-role create/update commands validate strict typed payloads, permit only shared product resources, and separately require the caller to possess every grant being written. Keys are trimmed/lowercased, comma-free, at most 128 characters, unique per organization, and immutable after creation. Built-ins remain inspectable/read-only, while cloning projects product grants only. The shared public auth boundary now defaults every normalized `/api/auth/organization/*` request to 404 except the exact `set-active` endpoint required by login and post-acceptance navigation. Trusted server-side `auth.api` adapters remain unaffected, and future Better Auth organization routes cannot silently enlarge the browser surface.
- Physical role deletion was deliberately rejected after comparing four architectures. A check-then-delete service has an invitation-acceptance gap because Better Auth updates invitation status before member creation. Advisory or parent-row locks cannot close that two-transaction gap. Normalized assignment/reference tables with foreign keys would be exact but duplicate Better Auth's comma-string schema and add disproportionate trigger/migration machinery for this organization. The chosen lifecycle is retirement: remove every grant and stop assigning the stable key. PostgreSQL enforces canonical/unique role keys, rejects unknown custom-role tokens on new member or pending-invitation writes, and blocks both DELETE and TRUNCATE outside the explicit `_test` cleanup escape hatch. Startup takes one write-conflicting lock across roles, members, and invitations before auditing or installing invariants; the five-second timeout makes a busy/incompatible deployment fail instead of accepting an audit-to-DDL race.
- Roles and members use ordinary routes, native tables, checkbox fieldsets, the shared native confirmation dialog, Router queries, and typed feature services/adapters. No table library is used where there is no real sorting/selection requirement, no form/cache/DI layer duplicates the framework, and no Zag/Kobalte peer override is introduced during the Solid 2 RC. `@axe-core/playwright` is the only added library; its first run found a real global compatibility-theme link/eyebrow contrast leak, which was fixed by scoping those colors to the lab shell.
- Permission-aware navigation exposes roles only with `ac:read` and the combined members page only when both of its independent member/invitation queries are authorized. Direct management identifiers use the shared opaque UTF-8 route codec and malformed/noncanonical paths are rejected by the production allowlist. Unknown historical role tokens are visible at the service/UI boundary, while startup now refuses deploying the stricter database invariant over an already-dangling production assignment. The pure protected-target rule and public organization boundary each live once in `admin-core`; both applications consume them instead of maintaining security-sensitive copies.
- Both applications pass type-check and lint. After moving duplicated policy/boundary tests to their owning shared package, the current admin passes 39 tests, admin-v2 passes 153 active tests plus six guarded PostgreSQL/auth tests, and admin-core passes 36 tests. The guarded suite proves canonical and known-role constraints, stable concurrent create conflict, verified multi-role projection, nonmember/unverified rejection, and physical DELETE/TRUNCATE refusal. Ten serialized built-production browser tests pass, including role create/update/retirement, default-deny raw organization reads/mutations, custom-role member assignment and invitation acceptance, native dialog focus return, cancellation, identity-preserving member removal, and serious/critical axe scans alongside every prior auth/provider regression. The sixteen-test compatibility-lab browser suite also passes. The disposable database returned to its three-owner baseline with zero sessions, invitations, custom roles, or named fixture rows.

The independent access-management review found and closed the raw self-leave endpoint, unrestricted provider member/invitation reads, rollback-only self/custom-target authorization drift, the startup audit-to-DDL write race, and TRUNCATE's bypass of row-level delete triggers. It also drove the default-deny organization HTTP architecture, shared protected-target policy, and custom-role acceptance browser proof. The remaining exact-race behavior in current-admin role creation is intentionally left with Better Auth: the database unique index preserves integrity, sequential duplicates already receive Better Auth's stable error, and replacing the provider command with direct SQL would duplicate v2's grant-subset authorization merely to improve a rollback-only concurrent error response.
The final independent pass reported no remaining material correctness, security, architecture, or maintainability findings.

Email-template feature-slice verification on 2026-08-26:

- History in `6740a34`, `95afe8c`, and `feb1288` supports one route editor, create/default/preview behavior, and visible visual-template inventory. It does not establish bulk template deletion as a product requirement. The port therefore uses `/emails`, `/emails/templates/new`, and canonical numeric detail routes; retains one-record confirmation; keeps visual templates read-only until a compatible `body_source` editor exists; and requires exactly one Listmonk content slot for HTML campaign templates.
- The feature owns strict Valibot commands and camel-case DTOs, exact `template:view/create/edit/delete/set-default` authorization, and product rules. A narrow Listmonk adapter owns private v6 response schemas and the exact list/detail/create/update/delete/default/saved-preview/draft-preview protocols. The shared transport owns only URL/token headers, timeout, content type and bounded-body handling, and status-only failures. No provider diagnostic or token crosses the boundary.
- A disposable real Listmonk `v6.2.0` instance verified the full create/update/saved-preview/draft-preview/default/restore/delete workflow. This canary caught two details that TypeScript fixtures alone would miss: set-default returns the complete template array, and a missing valid numeric template detail returns HTTP 400 rather than 404. The adapter now normalizes both 400 and 404 only for its nullable detail lookup; other provider 400s remain failures. Listmonk v6's set-default update does not verify that its target row still exists, so a deletion race can return success after clearing the prior default. The adapter therefore requires the returned array to mark the requested ID as default and fails closed otherwise. The integration guard requires an exact confirmation phrase, loopback origin, disposable token prefix, and explicit test command.
- The preview uses Listmonk's renderer and is displayed only in a titled `sandbox=""` iframe with `referrerpolicy="no-referrer"`. Accessibility scans cover the admin-owned page and intentionally exclude the unique-origin provider document, where axe cannot inject; the iframe contract and rendered frame content are asserted separately. Sandboxing blocks active capabilities but does not block remote image, CSS, or font fetches from provider-rendered HTML. The current choice preserves rendering fidelity while suppressing the admin URL as referrer; use a fetch-and-rewrite proxy or a stricter preview CSP only if hiding the operator's network address becomes a requirement. The production browser run also exposed that Solid 2 preserves a marked public error's message/status but does not serialize its non-enumerable safe symbol. Public errors now carry an enumerable app-owned wire brand plus an integer 400–599 status; arbitrary status-bearing errors, network failures, and sanitized errors still receive the generic client fallback.
- A native semantic filter table and native forms cover the small production inventory; adding TanStack Table, Query, a form library, CodeMirror, Zag/Kobalte, or another state/DI layer would add machinery without a demonstrated requirement. The development Compose service is pinned to `listmonk/listmonk:v6.2.0`; production stays on its inventoried v6.0.0 image until the backup/canary maintenance window prevents an automatic source-deploy upgrade.
- The exact type-check and lint pass. Unit coverage is 191 active passing tests across thirty-two files plus seven guarded tests; the real Listmonk contract test passes and self-cleans. A fresh production build passes, all eleven serialized production browser tests pass against disposable PostgreSQL and deterministic provider fixtures, and all sixteen compatibility-lab browser tests pass. The production suite covers template permission discovery, filtering, direct editor load, sandboxed saved/draft previews, public validation text, create/update/default/delete, dialog focus/Escape, no-delete default protection, accessibility, a role with no template access, and independent `view` plus `set-default` access without edit.
- The independent template-slice review initially found a forgeable public-error display rule, hidden set-default failures for a permission-valid read-only role, stale draft-preview races, incomplete visual/fixture coverage, and response-size/default-race mismatches. Those findings produced an enumerable app-owned error brand, generation-based preview invalidation, exact restricted-role browser coverage, byte-accurate input and bounded-response tests, visual saved-preview coverage, and returned-default verification. Its final pass reported no remaining material correctness, security, architecture, fixture-fidelity, or maintainability findings.

Mailing-list and subscription-sharing feature-slice verification on 2026-08-27:

- History supports one `mailing-lists` vertical slice, not separate persisted “forms” state. `/emails/lists` owns authenticated list inventory and CRUD; `/emails/forms` is a derived publish/share view over the same list projection. Commit `2eab195` deliberately removed the web application's roughly 550-line authenticated Listmonk client and token handling. That boundary remains: admin owns authenticated configuration and snippet generation, while `apps/web` owns public rendering, validation, baseline bot friction, and the only calls to Listmonk's unauthenticated `/api/public/*` endpoints. Both applications use Listmonk's private Docker origin; Caddy blocks direct public access to `/api/public/*` and Listmonk's generic `/subscription/form`, while retaining only opt-in/preferences/privacy links, archives, browser-view/tracking links, and static assets required by delivered email. The mail-site allowlist and fallback live in an order-preserving Caddy `route` block; otherwise Caddy's directive sorter moves the unconditional 404 ahead of the proxies.
- The production inventory is small—two lists and two unconfirmed subscriptions—so native semantic tables, native forms, Router queries, and the existing dialog/toast facades remain the simplest architecture. TanStack Table v9 would add adapter/reactivity churn without sorting, pagination, selection, column visibility, or virtualization requirements. TanStack Query/Form would duplicate Router query and native form ownership; Zag/Kobalte would introduce Solid 2 RC peer risk for controls already covered by native HTML. A durable queue becomes justified only for restart-safe fan-out or long-running bulk work. No library was added for this slice.
- The admin feature boundary owns strict Valibot commands, camel-case DTOs, exact `list:view/create/edit/delete` permissions, private-plus-double-opt-in creation defaults, stale-version checks, temporary-list read-only policy, and the Listmonk 6 description-clearing limitation. The Listmonk adapter owns private provider schemas and exact bounded catalog/detail/POST/full-PUT/singular-DELETE protocols. Catalog reads request exactly page 1 with 1,000 rows and fail closed if Listmonk does not honor that bound, reports more than 1,000 rows, or returns a partial catalog. Full PUTs merge the fresh provider projection so tags and other feature-owned values are not silently cleared.
- Forms expose snippets only for active public lists. Active private lists may be published and active public lists may be made private. Archived lists have no sharing mutation—even if their stored type is public—and must be reactivated explicitly on the detail route. Temporary lists remain provider-managed. Embeds are list-scoped with `list=<uuid>&embed=1`; archived, private, removed, mixed-validity, or forged selections are rechecked against a fresh public allowlist immediately before subscription.
- The web boundary is one bounded Listmonk transport, one pure subscription-policy service, and one thin SvelteKit route. It limits JSON to 1 MB, times out upstream calls, rejects malformed or duplicate catalogs, bounds email/name/list UUID/count inputs, treats a filled honeypot as indistinguishable success without upstream work, does not log raw errors or subscriber data, and maps provider failures to structured non-PII reports. The Listmonk `has_optin` response controls the success copy, so double opt-in says to check the inbox and single opt-in reports completion. The embed scope is enforced both at render and submit time. The honeypot is deliberately described as bot friction, not rate limiting. No abuse evidence currently justifies another service or interactive challenge; if traffic shows a problem, prefer edge rate limiting first, then evaluate ALTCHA or Turnstile against accessibility, privacy, deployment, and false-positive costs.
- The old list-wide “resend opt-in” action was not migrated. It fetched an unbounded subscriber set, fanned out inside one request, acted on each subscriber's pending lists rather than the selected list, and reported HTTP 200 as “sent” even when no eligible subscription existed. A list-wide resend belongs in the campaign slice as Listmonk's durable native `type: "optin"` campaign with create/send/progress semantics; a single-recipient resend belongs in the subscriber slice. Neither requirement justifies a custom queue today.
- Guarded real-provider contracts pass unchanged against the production `v6.0.0` image/digest and the proposed `v6.2.0` pin. Both versions round-trip template and list catalog/detail/create/full-update/delete behavior, preserve an existing description when PUT receives an empty string, and expose the unauthenticated public catalog plus single-opt-in subscription response. The canary also recorded an internal upgrade difference: v6.0 stores API tokens verbatim while v6.2 stores their SHA-256 digest. The external `Authorization: token username:token` contract is unchanged, but the production upgrade still requires PostgreSQL backup, Listmonk's supported upgrade path, API-auth/public-subscription canaries, and an exact image pin. Double-opt-in delivery was not faked in the public contract: unit coverage verifies `has_optin: true`, while the real disposable public mutation uses single opt-in because no SMTP service is configured.
- Deterministic production-browser coverage seeds an active public list, active private list, archived public list, and temporary list. It verifies provider-error privacy/retry, temporary read-only presentation, stale edit rejection, the v6 description rule, tag preservation, active-only sharing, snippet copy/announcement, private/double defaults, one-record delete confirmation/focus return, serious/critical axe scans, view-only access without edit/delete/publish controls, and a list-only role whose primary Email link lands on its first authorized route. The final built-production aggregate passes all thirteen serialized scenarios; the compatibility-lab suite passes all sixteen scenarios. The admin passes type-check, lint, and 221 active unit tests with eight guarded tests skipped; the web app passes type-check, lint, build, and 56 active unit tests with one guarded test skipped. The disposable browser database self-cleans to zero sessions, fixture users, invitations, or custom roles, and `git diff --check` remains clean.
- The independent mailing-list review found two material boundary defects. First, Caddy exposed Listmonk's generic form and public subscription API, allowing callers to bypass the web policy and target archived-but-public UUIDs. Second, a list-only admin role saw Email navigation that always landed on the template-only route. The final implementation closes both paths, adds exact list-only browser proof, validates and inspects Caddy's adapted handler order, and accurately distinguishes honeypot friction from rate limiting. The reviewer's second pass reported no remaining material correctness, security, provider-fidelity, architecture, dependency, accessibility, or maintainability findings.

Campaign-authoring feature-slice verification on 2026-08-27:

- History in `804a07f`, `4f2929d`, `ad53f2c`, `acae055`, `130e010`, `4997b14`, and `0819276` explains the current surface rather than making every inherited interaction permanent. Rich authoring, saved preview, status operations, and bounded bulk draft deletion remain. The deliberate provider bulk-delete optimization from `130e010` is preserved; client-local filtering, sorting, faceting, and table state from `804a07f` are not domain behavior and were removed. Campaign analytics remains a separate later slice rather than coupling read-heavy fan-out to authoring.
- The feature owns strict Valibot DTOs and commands, exact campaign/list/template permissions, active-list policy, native opt-in rules, stale-version checks, and an explicit transition service. Commands are named `start`, `schedule`, `unschedule`, `pause`, `resume`, and `cancel`, not a generic status setter. The Listmonk adapter privately validates bounded v6 responses, requests a complete 1,000-row catalog without bodies, rejects incomplete or duplicate results, and owns exact create/full-update/status/preview/bulk-delete protocols. A fresh full update preserves provider-owned alternate body, headers, attributes, messenger/archive metadata, media IDs, and body source; a status mutation re-reads the campaign because Listmonk's immediate response may be stale, then requires the requested truth.
- One discriminated regular/confirmation form shares the genuinely common name, subject, list, ordinary campaign-template, scheduling, and lifecycle rules. A separate confirmation wizard would make the distinction more visually explicit but duplicate most editor and command wiring; fully generic schema-generated CRUD would hide provider constraints. The body/content-type controls and Lexical editor remain regular-only; Listmonk owns the generated opt-in body. Visual templates are not offered to this nonvisual editor: an unchanged legacy visual selection can be preserved, while visual import remains a separate future workflow. Lexical remains route-split because it already satisfies the authoring requirement; replacing it with TipTap/ProseMirror or adding a form library would trade a proven framework-neutral lifecycle for more migration surface without a product gain.
- Native `type: "optin"` campaigns implement truthful durable list-wide confirmation resend. Listmonk generates the confirmation body and accepts only double-opt-in lists. Single-recipient resend and test-send are deliberately deferred to subscriber/activity: Listmonk test-send requires a full campaign snapshot, silently drops unknown recipients from a mixed subset, and reports queue acceptance rather than delivery. Resolving exact known subscribers in that slice avoids presenting a false “sent” result. Neither workflow currently justifies `pg-boss`; the provider campaign is already the durable job.
- The campaign and shortlink inventories now use native semantic tables with fixed provider order. Campaigns keep the one high-value table interaction—draft-only bulk selection—using local signals and checkboxes, while local filter/sort controls and the custom table-core bridge are gone. This preserves the operational batch action without retaining a direct `@tanstack/table-core` dependency, compatibility route, adapter, or adapter tests. TanStack Table v9, AG Grid, hand-written local sort/filter state, TanStack Query/Form, and Zag/Kobalte were each rejected for the current surface. Server-backed URL search/order/pagination is the preferred scale path if measured inventory or operator behavior later crosses the documented thresholds.
- Guarded disposable canaries pass the same campaign adapter test unchanged against exact Listmonk `v6.0.0` (`sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1`) and `v6.2.0` (`sha256:f535d59e14991337a9f2d570273685378ae86b0d7698c3e00da444e3bc205286`). Both verify regular and native opt-in creation, provider-generated `OptinURL`, full provider-field preservation, saved preview, draft-to-scheduled-to-draft transition, bulk deletion, and zero remaining test campaigns/lists. Both ran in passive mode; no campaign was started or sent, and the exact containers, databases, and temporary configuration were removed.
- The current type-check and lint pass with no warnings. The full Vitest gate passes 249 active tests across 40 files with nine guarded tests skipped; both real campaign canaries pass separately. The built-production Chromium aggregate passes all fifteen serialized scenarios in 29.1 seconds, including provider-state preservation, stale rejection, preview sandboxing, the complete regular status lifecycle in the deterministic fixture, native opt-in generation, bounded draft select-all/bulk deletion, campaign-only navigation/authorization, and serious/critical accessibility scans. The simplified fifteen-scenario compatibility suite passes after deletion of the table-only lab. The campaign list route is 4.89 kB raw / 2.02 kB gzip and no longer imports either the table bridge or Lexical; the latter remains isolated to the authoring route at 165.83 kB / 52.37 kB. Removing the bridge reduced the common client web chunk to 46.06 kB / 17.75 kB. The disposable browser database self-cleans to one canonical user, organization, and membership with zero sessions, invitations, or custom roles.
- The independent campaign/table review found four material issues: select-all could exceed the 100-draft command bound; a saved preview could remain stale after an edit; archived or newly incompatible selected lists could make a draft impossible to repair; and visual templates were offered to the nonvisual editor. The implementation now caps selection in both presentation and command layers, invalidates preview state on save, renders incompatible selected lists as removal-only, and permits only ordinary campaign templates while preserving an unchanged legacy visual selection. The fixture also resolves null creates to Listmonk's ordinary default template. The reviewer's final pass reported no unresolved material correctness, security, provider-fidelity, accessibility, architecture, maintainability, or Solid 2 blockers. Its inexpensive cleanup suggestions also removed an unused visual-source projection and status cast and made provider ordering explicit.

Subscriber inventory, detail, and activity feature-slice verification on 2026-08-27:

- History explains the inherited shape without making all of it a requirement. `130e010` introduced subscriber settings as one large modal with details, list editing, a second subscription view, bounces, activity, and test email, while its inventory loaded `per_page=all` into local TanStack filtering, faceting, sorting, pagination, and selection. `4997b14` ported that surface almost unchanged to Solid; `6db7615`, `a64a52c`, `3562405`, and `1408b1c` are structural, lint, route-group, or domain moves rather than evidence for the modal architecture. The port retains identity CRUD, consent-aware memberships, bounded bulk delete/blocklist, explicit opt-in requests, and actual activity. It does not migrate the empty import placeholder, the duplicated subscription tab, local table state, or bounces/test-send as hidden tabs; bounces and subscriber-resolved campaign test sends remain explicit later slices.
- The selected architecture is a provider-owning vertical slice: strict commands and normalized DTOs; a permission/product service; one private Listmonk adapter; thin Start Mode server functions; and ordinary inventory, create, and numeric detail routes. The existing all-in-one modal minimized navigation but coupled five independent loading, authorization, and failure domains and made direct linking impossible. A generic CRUD/repository layer would conceal consent and full-PUT hazards; a separate BFF would duplicate the existing authenticated server-function boundary; direct database writes would bypass Listmonk invariants. Separate routes add small routing files but produce reviewable URLs, lazy activity, independent errors, and straightforward later bounce/test-send composition.
- Inventory uses a native captioned table, 50-row provider pages, URL-owned literal email/name search, bounded page-scoped selection, and canonical fallback from an out-of-range page. It deliberately omits `order_by`: exact Listmonk v6.0 and v6.2 default to monotonic `id desc`, a total order that is safer for offset paging than `created_at desc` when imports share a timestamp. The UI labels that provider dependency “newest subscribers first.” The adapter regex-escapes search and never exposes Listmonk's SQL `query`; bulk commands accept at most 100 unique versioned identities. Local filter/sort/facet buttons were deliberately removed: they would describe only one fetched page or require the old unbounded catalog. TanStack Table v9/AG Grid would add adapter and state machinery without a multi-capability requirement; TanStack Query duplicates Router query ownership; a form library adds little to three short forms; Zag/Kobalte is unnecessary for native inputs and remains mismatched with the pinned Solid 2 RC. Add a table library only if measured requirements combine several of column visibility, complex sorting/faceting, virtualization, resizing, or large cross-page selection.
- Subscriber identity and memberships are separate commands. Creation first resolves the selected list kinds, POSTs an identity with `lists: []` and `preconfirm_subscriptions: false`, then uses explicit membership-status calls: single opt-in is confirmed, double opt-in remains unconfirmed, and deliberate preconfirmation confirms both without an implicit confirmation request. Disabled identities cannot be created with a pending double-opt-in membership because the ordinary editor could not later enable or confirm that state. Any ambiguous identity POST, later membership failure, or failed post-verification reports that the identity may already exist and tells the operator to search before retrying. Profile full PUT re-reads the provider row and preserves its fresh attributes and complete membership projection. Membership changes carry both subscriber and canonical membership versions, re-read immediately before mutation, preserve restricted/temporary/archived/unsubscribed rows, add before unsubscribe, use Listmonk's durable `unsubscribe` action rather than removal, verify the exact postcondition, and surface a typed possible-partial-mutation conflict. Ordinary editing cannot blocklist or restore a blocklisted identity; those remain dedicated workflows because blocklisting unsubscribes every membership.
- Public server-function projections follow least privilege. `subscriber:view` returns identity/profile data without membership counts, list names, list UUIDs, descriptions, consent status, or metadata. Memberships additionally require `list:view`; activity additionally requires `campaign:view` because it contains campaign identity/subject and tracked destinations. Subscriber-only browser coverage inspects serialized `/_server` payloads, not merely hidden JSX. Membership and activity loading/errors remain section-local with retry, and activity destinations become links only for absolute HTTP(S) URLs.
- Activity now calls Listmonk's actual `/subscribers/:id/activity` endpoint lazily. The old modal called the privacy export endpoint and labeled it activity. A single-recipient opt-in request is shown only when a fresh enabled identity has an eligible unconfirmed double-opt-in membership and the operator can view its lists. The UI reports “request accepted,” never “sent,” because HTTP success does not prove delivery; an invalid/lost/5xx acknowledgement warns that Listmonk may already have accepted the request and tells the operator to wait rather than risk duplicate mail. The unused `resolveEmails` seam was removed: the later campaign test-send slice must define an explicit safe-recipient policy instead of equating any known identity—including disabled, blocklisted, or unsubscribed identities—with eligibility. The web application continues to own public subscription submission and consent policy; admin membership commands cannot replace that public boundary.
- The deterministic upstream contains 58 subscribers so both provider pages are exercised, plus disabled, blocklisted, pending-double-opt-in, protected-membership, regex-literal, nested-attribute, and activity cases. It reproduces Listmonk v6's implicit create-time opt-in side effect so an accidental nonempty identity POST fails the no-mail browser assertion. The production workflow verifies no sort/filter UI, URL pagination/search and out-of-range canonicalization, page-scoped selection, stale profile rejection, direct detail reload, provider-owned attribute preservation, durable unsubscribe/meta preservation, protected membership presentation, local activity failure/retry, explicit mail-free unconfirmed create, truthful opt-in acceptance, least-privilege serialization, deletion, and serious/critical accessibility. That run found a real integration omission: subscriber documents were absent from the production runtime's completed-route allowlist, so client navigation worked while direct loads returned 404. Canonical subscriber route decoding and positive/negative HTTP-boundary tests now close it.
- Temporary passive/no-SMTP canaries ran the same create adapter against exact Listmonk `v6.0.0` (`sha256:bf3903d54a468ba0544629b474a9c78714b1419ba9f89e186590264fa40d4ea1`) and `v6.2.0` (`sha256:f535d59e14991337a9f2d570273685378ae86b0d7698c3e00da444e3bc205286`). Recorded HTTP bodies prove both modes always POST an empty-list identity; default mode then adds single=`confirmed` and double=`unconfirmed`, while preconfirm mode explicitly adds both as `confirmed`. Neither version called `/optin`, started a campaign, or logged delivery activity. Each disposable database ended with zero canary subscribers, lists, or campaigns; the guarded temporary test and containers were removed after the run, while permanent mocked transport/browser coverage retains the regression contract.
- Final aggregate gates pass. The admin-v2 type-check and lint are clean; Vitest passes 300 active tests across 45 files with nine guarded tests skipped. The built-production Chromium suite passes all seventeen serialized scenarios, including the full subscriber workflow and a subscriber-only serialized-payload RBAC case; the compatibility lab passes all fifteen scenarios. Repository-wide type-check, lint, and test gates pass. The disposable browser database returned to one canonical user, organization, and membership with zero sessions, invitations, or custom roles, and `git diff --check` is clean. Production source is 14,526 lines versus 15,270 in the current admin: 744 fewer lines (4.9%). Excluding the 275-line compatibility-lab route surface, v2 production source is 14,251 lines: 1,019 fewer (6.7%). The larger test corpus is deliberate rather than shipped product complexity: v2 has 5,679 test lines under `src` plus 3,611 browser-fixture/spec lines, while the current admin has 179 and 655 respectively.
- The independent subscriber review initially found create-time double-opt-in mail side effects, overbroad subscriber serialization, campaign metadata leakage, coupled error boundaries, unbounded page input, unsafe bulk/action eligibility, ambiguous opt-in retries, and a disabled-state consent trap. The corrections use identity-only create plus explicit membership statuses, least-privilege projections, section-local retries, bounded/canonical paging, exact action subsets, and typed ambiguous/partial outcomes. Its final pass covered the last provider-owned single-to-double opt-in race with a zero-POST invariant and reported no unresolved Critical, High, or Medium correctness, security, provider-fidelity, architecture, dependency, accessibility, or maintainability findings.

Bounce-record feature-slice verification on 2026-08-27:

- History supports bounce management as a small independent feature, not another responsibility of the subscriber manager. `95afe8c` began with bounded server pagination; `804a07f` replaced it with an unbounded `per_page=all` TanStack inventory; `130e010` added atomic selected deletion and subscriber-scoped history; and `4997b14` ported that behavior to Solid. The retained product behavior is global history, selected clearing under `bounce:delete`, complete-history clearing under distinct `bounce:clear-all`, and lazy subscriber-scoped history/clearing. The port fixes the legacy campaign projection, which expected nonexistent `campaign_id` instead of Listmonk's nested `{ id, name } | null`, and fixes subscriber-scoped reads that previously authorized only `subscriber:view` instead of `bounce:view`.
- One `bounces` vertical slice owns normalized records, exact permissions, global and subscriber-scoped queries, and clearing commands. Its private Listmonk adapter owns strict v6 schemas, the 1,000-record subscriber endpoint cap, explicit `created_at desc`, repeated-ID deletion parameters, exact acknowledgements, and subscriber-identity binding on scoped responses. The public `bounce:view` projection deliberately contains the recipient email and campaign display name needed to triage a bounce, but strips subscriber UUID/ID/status/metadata and campaign IDs; campaign subjects, content, and activity still require `campaign:view`. Subscriber detail composes the feature only when `bounce:view` is present; its lazy loading, provider failure, retry, confirmation, and pending state are local to that section. Campaign bounce counters remain campaign-owned aggregates. Bounce processing settings, webhook ingress, and public subscription behavior remain separate operational, infrastructure, and web boundaries respectively.
- The global inventory is a native semantic table with 50-row server pages, URL-owned pagination, a 10,000-page input bound, at most 50 page-scoped selections, and stale-response-safe canonical URL fallback from Listmonk's unusual all-zero out-of-range pagination envelope. Listmonk exposes only `created_at desc` for this use case—no cursor, ID ordering, or secondary tie-breaker—so these are explicitly live operational pages, not a stable audit snapshot. Equal timestamps and concurrent arrivals/clears can shift, duplicate, or omit rows between page requests; both the UI and the fixture (including a tie across the page boundary) expose that limitation. Exact snapshots would require an unbounded fetch, direct database coupling, a stateful snapshot BFF, or a provider change, none justified for page-scoped triage. There are no local sort/filter controls: client filtering one fetched page would be misleading. TanStack Table v9, AG Grid, Query/Form, and Zag/Kobalte add no current capability; adding bounces to `SubscriberManager` would reduce file count while creating the wrong permission and ownership boundary; a thin route-to-transport proxy would mix provider DTOs with public contracts. The selected native feature slice is the smallest option that preserves independent errors and later composition.
- Clearing copy deliberately says “bounce records” or “history,” never that a subscriber was repaired. Listmonk deletion removes records only; it does not restore a blocklisted identity or resubscribe memberships. Selected deletion is bounded to 100 unique positive IDs, clear-all has its own permission, and both global and subscriber-scoped destructive actions require confirmation and visible pending/error state. The adapter intentionally does not post-verify deletion because concurrent delivery can legitimately create a new bounce immediately after clearing.
- The deterministic production fixture contains 53 records across hard, soft, and complaint types, campaign-present and campaign-null rows, two provider pages, a timestamp tie across the page boundary, and subscriber-scoped history. It reproduces the v6 all-zero out-of-range pagination envelope and supports idempotent selected, subscriber, and clear-all deletion without external delivery. Browser coverage proves bounded pagination, absence of local filter/sort UI, canonical fallback, selected clearing, section-local subscriber failure/retry, subscriber clearing, complete clearing, serious/critical accessibility, and a `bounce:view`-only role that lands directly on the read-only bounce route and whose serialized server payload contains only the deliberate bounce-triage projection. No destructive live-provider canary was run: source-level v6.0/v6.2 contract comparison plus strict mocked transport coverage is the safer verification for an operation whose only real result is data deletion.
- Final gates pass: type-check and lint are clean; Vitest passes 314 active tests across 48 files with nine guarded tests skipped; the built-production Chromium aggregate passes all nineteen serialized scenarios; and the compatibility lab passes all fifteen. The disposable browser database returns to one canonical user, organization, and membership with zero sessions, invitations, or custom roles, and `git diff --check` remains clean. The independent review found two Medium issues: the initial public DTO exposed cross-feature provider IDs/status, and the paging description implied stability Listmonk cannot provide. The minimized triage projection plus serialized-payload proof and the explicit live-page contract/tied fixture close both findings. The reviewer then reported no unresolved Critical, High, Medium, or Low correctness, security, provider-fidelity, architecture, dependency, accessibility, fixture-fidelity, or maintainability findings. Its source comparison also found the relevant Listmonk v6.0/v6.2 model, ordering, deletion, and response contracts unchanged; the app retains independent Better Auth enforcement even though v6.2 added provider-side list authorization to subscriber-scoped reads.

Campaign email-analytics feature-slice verification on 2026-08-27:

- History in `4997b14` explains the inherited client-owned filter state, custom multi-select/date controls, browser-local labels, and aggregation, but does not make those implementation choices product requirements. The new `/emails/analytics` route is a small independent read slice rather than another responsibility of campaign authoring. Its ordinary GET form owns repeated `campaign`, `from`, and `to` URL parameters; native checkboxes expose the provider-ordered catalog; no request runs until at least one still-visible campaign is selected. Invalid, duplicate, over-limit, or removed IDs and impossible/reversed/overlong date ranges fail before provider access.
- The feature owns strict Valibot queries and normalized points, a 100-campaign bound, endpoints at most 366 days apart, exact `campaign:view` authorization, safe aggregation, and independent view/click loading and error boundaries. The private Listmonk adapter owns authenticated transport, strict response envelopes, requested-campaign binding, duplicate-bucket rejection, deterministic timestamp/campaign ordering, and one repeated-ID request per metric. The route's catalog check is a URL/UX stale-ID guard for normal navigation, not server authority. The server deliberately authorizes Listmonk's global `campaign:view` capability rather than inventing per-campaign membership; a combined BFF that re-fetched the catalog for every metric would add provider work and coupling without strengthening authorization until resource-scoped campaign access exists. Exact `keyFor(query)` retry invalidates only the failed metric selection.
- This batching contract intentionally targets Listmonk v6.2, not the inventoried v6.0 production image. With individual tracking enabled, v6.0's analytics SQL used `DISTINCT ON(subscriber_id)` across every requested campaign, so a subscriber appearing in more than one campaign could make later campaigns disappear. Listmonk fix [`333e03fb`](https://github.com/knadh/listmonk/commit/333e03fb) changed that to `DISTINCT ON(subscriber_id, campaign_id)` in v6.2. The adapter therefore single-flights an authenticated `/api/config` compatibility check, accepts only canonical stable `v6.2.0` through later v6 declarations, and fails closed before analytics on v6.0/v6.1, nightly, malformed, noncanonical, overflow, or v7 declarations. The deployment guarantee is still the exact tested v6.2 image/digest: a declared version can be spoofed by a custom build. Production must receive a PostgreSQL backup, upgrade canary, immutable pin, and authenticated version preflight before admin-v2 cutover.
- Preserving the rollback app's one-request-per-campaign `p-limit` fan-out would remain correct on both versions but carry up to 200 analytics requests and an obsolete dependency after the mandatory provider upgrade. Runtime version detection plus two query strategies would preserve v6.0 preview compatibility at the cost of permanent branching and double test surface. An unguarded v6.2 batch would be smaller but could silently undercount if misconfigured against v6.0. The selected exact v6.2 pin plus one cached analytics-local guard keeps the efficient provider-native batch and makes an incorrect deployment visible; general app startup and liveness do not depend on Listmonk availability.
- URL dates are inclusive UTC calendar dates. At the adapter edge they become explicit `T00:00:00.000Z` and `T23:59:59.999999Z` bounds because Listmonk compares timestamps directly and a date-only upper value excludes almost the entire final day. Daily UTC-midnight buckets remain compact; hourly or same-day buckets include an explicit UTC time, so browser timezone cannot shift a bucket or collapse two hours into the same label. The deterministic fixture enforces the exact timestamp bounds and returns two same-day hours to keep this behavior observable.
- Native forms, checkboxes, semantic lists, CSS bars, Router queries, and the existing campaign catalog cover the requirement. A chart package, TanStack Table/Query/Form, Zag/Kobalte, client store, custom multi-select, or new concurrency library would add machinery without another capability. The route keeps exact numeric values and accessible text rather than making a canvas/SVG chart the only representation. Umami remains the site-analytics provider and does not own Listmonk's campaign delivery analytics.
- Focused type-check, lint, diff hygiene, and 38 analytics/runtime tests pass after review corrections. The complete Vitest gate passes 346 active tests across 53 files with nine guarded tests skipped. A fresh production build passes; all twenty serialized built-production Chromium scenarios pass in 37.8 seconds; and the fifteen-scenario compatibility suite passes. The analytics workflow proves URL ownership, inclusive UTC requests, faithful short-range hourly labels, one request per metric, exact totals, stale-ID zero-request behavior, permission-aware navigation, serious/critical axe coverage, one-metric fault isolation, diagnostic privacy, and exact-key retry without refetching the successful metric. The disposable database returns to one canonical user, organization, and membership with zero sessions, invitations, or custom roles, and `git diff --check` remains clean. Independent review initially found the v6.0 multi-campaign undercount, date-only final-day truncation, browser-local hourly ambiguity, broad retry invalidation, an impossible hourly fixture range, overstated client catalog authority, missing operational documentation, and ambiguous range naming. After correction, its final pass reported no unresolved Critical, High, Medium, or Low correctness, security, provider-fidelity, Solid 2, fixture, accessibility, dependency, architecture, or maintainability findings.

Campaign test-send feature-slice implementation on 2026-08-27:

- Git history explains why the inherited surface exists but does not make it correct. `4f2929d` introduced arbitrary comma-separated recipients and a success toast in a large mixed Svelte change; `4997b14` ported it nearly verbatim to Solid. The old adapter posts only `{ subscribers }`, even though Listmonk v6.2 binds the test endpoint to the ordinary full campaign request and validates the saved campaign fields before resolving recipients. The old UI can therefore report an action that the provider rejects, calls queue acceptance “sent,” permits multiple client-controlled addresses, and has no dedicated behavioral test or focused history rationale. The rollback implementation remains untouched as a rollback path; admin-v2 implements the documented v6.2 contract rather than preserving that accidental behavior.
- The selected product architecture is a lazy section on subscriber detail with one native draft-campaign picker. The subscriber is already a visible, stable provider identity, so the public command contains only campaign/subscriber IDs and both expected `updated_at` versions. The server resolves the fresh email and campaign snapshot, requires `campaign:send` plus `subscriber:view`, and the UI additionally requires `campaign:view` for the catalog. Permissions assigned across multiple roles are intentionally unioned: Better Auth remains the authority through one atomic check per requested action, avoiding its combined-request requirement that one role alone satisfy the entire permission object. A campaign-detail subscriber picker would require a new server-search/pagination surface and invite arbitrary-recipient behavior; a separate route would duplicate both selectors for a one-command workflow; omitting test-send would be the smallest safe choice but would remove the real operator capability to render subscriber attributes and links. The selected subscriber-owned composition is the narrowest retained feature. It can become a separate route only if durable history/audit becomes a demonstrated workflow.
- Eligibility is deliberately stricter than Listmonk's raw test endpoint because that endpoint bypasses normal audience selection. The campaign must be an ordinary draft using either the built-in `email` messenger or an `email-*` named SMTP messenger. Named SMTP is valid only when a fresh authenticated `/api/config` registry contains that exact messenger; a removed configuration therefore fails closed instead of inheriting Listmonk v6.2's silent base-email fallback. Non-email campaigns are excluded from the picker and rejected before subscriber/config access. The subscriber must be enabled and have an active confirmed membership overlapping a campaign target list. Disabled, blocklisted, unconfirmed-only, unsubscribed-only, archived-only, and non-overlapping identities fail before the POST. Client email strings, recipient arrays, campaign body, headers, messenger, and list IDs are not accepted. A strict timezone-qualified version contract and immediate fresh GETs bind both identities; malformed/wrong IDs, malformed or duplicate messenger registries, duplicate or zero list targets, duplicate memberships, and stale versions fail closed.
- The private adapter constructs one allowlisted full v6.2 test request from the freshly read saved campaign: name, subject, list IDs, sender, messenger, regular type, custom headers, tags, template, content type, body/alternate body, visual source, media IDs, and exactly one server-resolved email. It never spreads the provider response and deliberately omits identity, status, progress, archive, attributes, and `send_at`; a retained past schedule can fail ordinary validation even though test-send never uses it. It issues at most one POST, rejects redirects instead of allowing native `fetch` to replay a 307/308 mutation, and requires exactly `{ data: true }`. Provider 4xx is a definite rejection. Network failure, timeout, redirect, 5xx, malformed JSON, false/missing acknowledgement, or extra acknowledgement fields are ambiguous because Listmonk may already have queued the email; the UI tells the operator to wait and check the inbox before deliberately retrying. No automatic retry, app queue, or idempotency claim is possible because Listmonk exposes no test-send key or queryable job.
- The confirmation and result copy treat the action as a real email with live subscriber-bound links. Queue acceptance does not prove SMTP delivery. Opening the message can add campaign views/clicks and subscriber activity; its unsubscribe URL remains active. These are product effects, not provider diagnostics, and are disclosed before submission. Acceptance has one durable `role="status"` announcement rather than a simultaneous toast duplicate. The lazy picker uses one persistent keyboard-operable `aria-expanded` toggle, so opening it does not remove the focused control. The deterministic v6.2 fixture records only exact complete requests, exercises active `email-primary` and non-email exclusion, and can separately model definite rejection and an acknowledgement-lost-after-queue outcome.
- No new library is justified. Valibot, Router queries, Solid signals, the existing confirmation facade, and a native `<select>` cover the feature. TanStack Table/Query/Form, Zag/Kobalte, `p-limit`, or `pg-boss` would not solve recipient binding, provider validation, or ambiguous delivery. A durable app queue would add a second queue while preserving the same unresolvable provider acknowledgement boundary.
- Focused type-check and lint pass. The independent adversarial test track passes sixty-one contract/service/adapter cases and found five boundary issues before closure: permissive timestamp parsing, unknown lazy-chunk failure reasons that could fall through as success, mixed valid/zero campaign targets, non-exact success acknowledgements, and an empty messenger-registry name. All five are fixed. The whole-phase reviewer additionally found native redirect-following could replay one application POST at the wire level, combined Better Auth checks disagreed with the UI's union-of-roles projection, named v6.2 SMTP messengers were omitted, disabled subscribers advertised an impossible action, success was announced twice, the lazy trigger removed keyboard focus, and the inactive named-messenger recovery copy incorrectly implied a non-email campaign. The fixes are covered by real 307/308 HTTP regressions, guarded auth integration, and built-production browser scenarios. Final gates pass: 411 active Vitest tests across 56 files with nine guarded tests skipped; 6/6 destructive production-auth integration tests; 22/22 serialized built-production Chromium scenarios; 15/15 Solid 2 compatibility scenarios; type-check, production build, lint, and diff hygiene. The browser suite proves named `email-primary`, non-email exclusion, exact payload/recipient ownership, split-role authorization, keyboard focus, one live accepted announcement, stale subscriber/campaign blocking, definite rejection, ambiguous diagnostic redaction, serious/critical accessibility, and no duplicate POST. The disposable database returns to one canonical user, organization, and membership with zero sessions, invitations, or custom roles.

Post-parity email-operations stabilization on 2026-08-27:

- The v1/v2 inventory initially selected SMTP and logs, then a field-by-field provider audit confirmed that SMTP-only was too narrow. The old five-tab page is not a trustworthy parity target: `130e010` introduced it while Compose pinned Listmonk v4.1, `a68418d` moved to unpinned `latest` hours later, and later history repeatedly repaired full-settings writes and secret preservation without updating the entire surface to v6.2. V1 still omits the v6.2 global tracking switch, current SMTP routing/retry fields, Azure/Lettermint/POP bounce configuration, and the valid `unsubscribe` bounce action; it also models SMTP headers in the wrong shape. The replacement therefore uses routed, product-owned slices rather than copying those tabs.
- The resulting architecture is hybrid rather than a copy of either the stale v1 tabs or Listmonk’s entire operator UI. `/settings/email/general` owns recipient branding/pages, sender defaults, notification recipients, archive behavior, and opt-in behavior; it also reports the public-subscription API, recipient root URL, bounce processing, and language as read-only provider invariants. `/settings/email` owns the complete Listmonk v6.2 SMTP contract. `/settings/email/performance` owns delivery throughput, error policy, the sliding window, and slow-query cache controls. `/settings/email/bounces` owns all v6.2 actions, SES/Azure/SendGrid/Postmark/Forward Email/Lettermint webhooks, and POP mailbox configuration. `/settings/email/privacy` owns tracking, recipient self-service, all four data-export scopes, and domain policy. `/settings/email/provider` documents the deliberately private security, media/storage, arbitrary messenger, executable appearance, database-maintenance, and update surfaces plus the SSH tunnel. `/emails/logs` owns a bounded, redacted diagnostic view. Import and media remain omitted because their old pages are placeholders without a demonstrated YAH workflow.
- Every settings mutation performs one fresh complete GET, validates all 68 known top-level Listmonk v6.2 fields and every fixed nested structure, applies only its feature-owned patch, clears only the eleven exact v6.2 secret-mask paths, and issues one full PUT. Unknown non-secret fields, custom SMTP headers, mailbox `return_path`, extra disabled mailbox records, and known v6.2 masked credentials survive. A pinned v6.2 provider remains mandatory because an unknown future secret path cannot safely be inferred from masked text. Invalid fixed auth/TLS/action/export modes, Go durations, and incomplete bounce policies fail before any write. Per-key PUTs remain rejected because every Listmonk settings write can schedule a reload and history proved parallel writes race one another. One process-wide queue serializes the complete GET/merge/PUT critical section for this admin instance; the private Listmonk UI must not write concurrently, and a future multi-instance admin deployment would require a distributed lock because Listmonk exposes no revision or ETag.
- SMTP and bounce reads never return provider-masked secrets to the browser. Commands distinguish retained credentials (`null`) from non-empty replacements, permit password-free SMTP tests only for `auth_protocol: none`, and deliberately do not claim to support clearing a saved credential because Listmonk’s full PUT cannot distinguish clear from keep. Successful bounce saves clear every replacement secret from browser state and convert it to an opaque saved marker; failed saves retain the draft. Enabling a credential-backed provider without a saved or replacement secret fails closed. Any blank or duplicate SMTP, bounce-mailbox, or messenger UUID blocks all full-document writes with an explicit private-UI recovery path, avoiding Listmonk’s ambiguous masked-secret matching for pre-UUID records. Destructive bounce deletion requires explicit acknowledgement and both `provider:manage` and `subscriber:delete`; only one POP mailbox can be enabled, and the provider’s one-minute scan floor is enforced for every saved mailbox. Ordinary general and privacy changes require `settings:edit`; SMTP mutations/tests, performance, ordinary bounce processing, and sensitive process logs require `provider:manage`. The built-in owner has both grants; a usable custom provider-operator role also needs `settings:view` to read and navigate the settings pages.
- Logs require the same provider-operations capability because diagnostics can contain sensitive operational context. The adapter reads a 5,000-line provider buffer, exposes 200 lines per page, and redacts common authorization, token, password, quoted-value, and environment-style credential forms before returning an app-owned DTO. This is useful diagnosis, not a claim that arbitrary log text is safe to publish.
- Each settings route constructs its signal-owning form only inside a resolved-child `Show`. Under Solid 2 RC.2, constructing that child while its route query was suspended left client navigation pending; the explicit resolved boundary makes async ownership visible and is covered by the built browser flow.
- Router `2.0.0-next.17` declares `revalidate()` as synchronous `void`. Mutation flows now invalidate without fake `await`s, while the explicit log Refresh control uses Solid 2 `isPending(page)` so its disabled/loading state follows the actual query. Decoder-backed `matchFilters` reject malformed positive-integer and versioned opaque product parameters before client routing can issue a query for `0` or `""`; the public invitation route intentionally retains invalid IDs as a non-disclosing user-visible state.
- Router `next.17` reuses a route component when only its dynamic parameter changes. Every signal-owning dynamic product route and the invitation route now creates a keyed identity child owner, preventing dialogs and drafts from leaking between records during client navigation. Subscriber profile and membership forms additionally keep separate dirty/reset ownership so refreshing one successful mutation cannot erase unsaved changes in the other. SMTP rows use Solid 2 custom-key `<For>` ownership, retaining focus/caret while immutable drafts are replaced, and clear replacement passwords after a successful save.
- Versioned mutations await a concrete primary query after synchronous invalidation so the next write cannot reuse stale provider versions. A failed freshness read is reported as “saved, but could not reload,” never as a failed write that invites a stale retry. Analytics uses `isPending(snapshot)` to disclose Solid 2's stale-while-revalidate period transition and contains period errors beneath the persistent picker; `latest(period)` was tested and rejected because the source signal already commits immediately.
- The final built-browser aggregate found one additional Solid 2 scheduling edge: the subscriber search’s first deferred synchronization effect could run after a fast user edit and overwrite the draft with the initial provider search. The synchronization now skips its initial run and resets only when a later resolved search actually changes. The same aggregate confirmed that denied analytics is intentionally contained by the feature-level error boundary while stable application chrome remains available; the older expectation of a page-wide error was corrected rather than weakening that isolation.
- Final gates for this stabilization pass: repository type-check and lint pass; `git diff --check` is clean; a production-mode Solid 2 build passes; all 453 active admin-v2 Vitest tests pass with nine guarded provider/database tests skipped in the ordinary run; all six destructive PostgreSQL authorization tests pass separately and self-clean; all fifteen compatibility-browser scenarios pass; and all twenty-four serialized built-production browser scenarios pass. The production flow saves and re-reads SMTP, General, Performance, Bounces, and Privacy; proves export-scope and secret retention, mailbox uniqueness, destructive-action handling, provider-owned documentation, redacted logs, role boundaries, and unchanged Shlink/Umami/Listmonk product workflows.

### Temporary migration constraints

- **Keep CSR for the initial Solid 2 production cutover, then re-evaluate it after observation.** The admin has no SEO requirement, so CSR remains reasonable, but the original hydration-mismatch rationale from `4997b14` became weaker after route groups were introduced in `a64a52c`. The replacement now passes direct loads, session-expiry behavior, route-group navigation, and its minimal production-container contract. Enabling SSR would change authenticated data execution, document generation, hydration, and deployment at the same time as the provider/framework cutover without a measured user benefit. Reconsider after production stability, not inside this release.
- **Keep the root `Loading` (`Suspense`) boundary because the Solid 2 ablation demonstrated a distinct purpose.** It was added in `3714787` because lazy route-group components otherwise failed to render. The nested app-layout boundary supplies the visible loading state after that layout exists; the root boundary covers loading before it exists. On 2026-08-27 the root boundary was temporarily removed and the other fourteen built compatibility scenarios—including direct loads and lazy routes—still passed, but holding the initial route query for five seconds produced no `Loading admin…` state at all. Restoring the boundary restored the explicit pre-layout fallback. Keep it for the current Router `next.17` target and rerun this focused ablation after a stable Router/plugin upgrade; it is evidence-driven behavior, not permanent doctrine.

## Deferred, with thresholds

- Remaining inventories: add server-backed URL search/order/pagination when operators regularly struggle to locate records or measured full-catalog transfer/rendering becomes materially slow, well before a provider completeness cap is reached. Subscribers already use this pattern. Preserve only demonstrated selection/totals/order semantics; do not recreate local table state by default.
- Durable bulk jobs: introduce only when an operation must survive process restart or regularly exceeds request timeouts.
- Listmonk module split: move schemas/protocols feature-by-feature, preserving the masked-settings and restart behavior with an integration fixture.
- Rich-text editor: keep Lexical route-split at the measured 174.81 kB raw / 55.14 kB gzip; reconsider only if authoring needs change or another framework-neutral editor materially improves lifecycle, output compatibility, and total migration cost.
- Permanent account deletion: separate owner-only product operation, never a side effect of membership removal.
- Physical custom-role deletion: keep retirement unless a demonstrated lifecycle requirement justifies normalized assignment references and database foreign-key restriction; do not reintroduce check-then-delete.
- Current-admin concurrent duplicate role UX: accept Better Auth's generic error for the exact race while the unique index preserves integrity; revisit only if rollback concurrency becomes operationally relevant or Better Auth exposes a typed conflict cause.
- Role editor aggregate checkboxes: add an indeterminate visual state for partially selected permission groups when the Solid 2 control contract is revisited.
- Successful destructive-dialog focus: choose an intentional fallback focus target when the triggering row is removed; cancellation already restores focus to the connected trigger.
- SSR and root `Suspense`: evaluate only after Solid 2 behavioral parity, using the exit tests above.

## Independent review record

The integrated review and its verification pass found eleven material or correctness-adjacent cases. All were addressed before phase completion, and the reviewer reported no remaining material findings:

1. Custom-role permission resolution incorrectly depended on `ac:read`; replaced by a trusted active-organization adapter lookup.
2. Failed invitation email delivery left a pending record; same-role retries now use Better Auth's resend path, while role changes require cancelling the existing invitation.
3. An initial accepted-without-member repair heuristic could also recreate a deliberately removed membership from an old accepted invitation. The repair endpoint and heuristic were deleted. Acceptance now begins in one server invocation that first observes a live pending canonical invitation and delegates the state transition to Better Auth; historical accepted records never create membership.
4. Custom role renaming stranded assigned members; role keys are now immutable.
5. Multi-role state could be read but not safely edited; server inputs and member/invitation dialogs now manage deduplicated role arrays.
6. Authorization infrastructure errors bypassed safe mapping; permission enforcement is now inside the correlation-aware error boundary.
7. Umami retained revoked tokens; an idempotent GET now clears only its used token, shares the next login, and retries once.
8. Analytics fan-out and upstream error buffering were unbounded; concurrency is capped and only the first 2,000 response bytes are streamed and retained.
9. Built-in role and permission lookups accepted inherited JavaScript object keys; own-property checks now keep names such as `constructor` and `__proto__` on the dynamic/invalid paths as appropriate.
10. A disabled multi-select still allowed raw chip removal; the chip action is now disabled and guarded, with shared chip styling imported explicitly by both controls.
11. Multi-role assignments rendered as one comma-joined machine value; members and invitations now show one role badge per assignment.

The later dependency/auth reviews found four additional release-blocking boundary issues and changed the onboarding architecture before migration continued:

1. Ordinary verification promoted attacker-planted credentials and sessions. Replaced signup-first onboarding with the pinned magic-link plugin's built-in unproven-access revocation, followed by a fresh-session password step. A two-client contract test now preserves this invariant.
2. The generic Better Auth catch-all allowed anonymous signup followed by organization creation and owner-level access to global integrations. Email/password signup and user organization creation are now disabled, with regression coverage for both endpoints.
3. The public invitation SQL query recreated the advisory's disclosure surface by returning email, account existence, role, and organization to anyone with the ID. Anonymous output now contains only landing-state availability; sensitive details appear only for a matching verified session.
4. The first verification link configuration could create sessions on unrelated devices, callback errors were silent, and state changes were not announced. The replacement uses canonical forced callbacks, hashed one-time tokens, safe callback-error UI, alert/status regions, focus transfer, and an error boundary.

Three independent agents reviewed history, auth/security, architecture/dependencies, and invitation UX. Their second pass found and drove removal of accepted-invite resurrection, canonical-organization isolation, consume-time token binding, handler-level rate limiting, strict verified login, and executable bootstrap/audit operations. The final operational second pass approved the attested-owner transaction and deployment sequence after the advisory-lock ordering, immutable-image audit gate, and exact maintenance runbook were added. No material security, correctness, or maintainability finding remains in this stabilization phase.

The Solid 2 production-platform slice received separate history/parity and architecture/dependency reviews. They found two medium issues: the production parser trimmed opaque credentials, and the destructive PostgreSQL auth suite was merely opt-in. The parser now preserves credential bytes with regression coverage; the suite now requires an exact confirmation phrase plus an `_test` database name and runs in CI against a disposable PostgreSQL service. The exact CI path passed all three integration tests in Bun 1.3.11 and self-cleaned its fixture users, role, and sessions. Both reviewers returned PASS with no remaining actionable findings. The staged session query is deliberately a next-slice seam: the first protected layout must consume it and prove it through the built server, or remove it.

The first Solid 2 product slice received another history/parity and architecture/dependency review. Review changed the implementation in six places before acceptance: a nested no-fallback loading boundary was removed; lab-wide form CSS was scoped; Solid 2 lowercase DOM attributes were corrected; protected page loading was nested inside stable chrome; error styling moved with its root-owned component; and wrong-account invitation sign-out retained the canonical invitation URL. The final passes also required a neutral document title, Router 2-typed invitation params, an announced forgot-password result, shared pure invitation state, independent runtime gates on every shared `/_server` function, query revalidation before error-boundary reset, a valid and browser-decoded SVG, AA-contrast actions/focus rings, and the live-invitation built-production/PostgreSQL browser suite recorded above. The reviewers approved the single-router route-group architecture and found no justified dependency addition beyond Rubik; no material finding remains in this slice.

The analytics slice received separate history/security and architecture/dependency reviews. Both approved the feature-specific Umami boundary, normalized DTOs, native semantic presentation, absence of new dependencies, truthful dashboard deferral, and server-owned authorization. Review added a deferred late-old-token 401 test, exact login request assertions, a real no-analytics custom-role browser fixture, and a narrow atomic live announcement. Final review returned PASS with no remaining correctness, security, architecture, Solid 2, provider, dependency, accessibility, or test-rigor finding.
