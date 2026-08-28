# Admin browser parity suite

This suite observes browser-visible contracts rather than Solid components, router internals, or server-function wire formats. The same specs run as the `current` project and, when configured, the `v2` project.

## Running it

Install the pinned workspace dependencies and Chromium once:

```sh
bun install
bunx playwright install chromium
```

Start a database-ready admin separately, then run:

```sh
ADMIN_E2E_BASE_URL=http://127.0.0.1:3002 bun run test:e2e
```

`ADMIN_E2E_BASE_URL` defaults to `http://127.0.0.1:3002`. To compare both implementations with one command:

```sh
ADMIN_E2E_BASE_URL=http://127.0.0.1:3002 \
ADMIN_V2_E2E_BASE_URL=http://127.0.0.1:3003 \
bun run test:e2e
```

Use `bun run test:e2e:current` or `bun run test:e2e:v2` to select one project; the v2 command requires `ADMIN_V2_E2E_BASE_URL`.

Both URLs must be HTTP(S) origins without credentials, paths, queries, or fragments. The harness does not start the application because the admin's database and integration topology belong to the test environment, not to Playwright.

The unauthenticated suite verifies readiness, login labels and native validation, keyboard order, protected direct loads, and safe unknown-route behavior. The readiness test intentionally fails when the database is unavailable.

## Optional authenticated fixture

Authenticated specs are skipped with an explicit reporter reason unless both variables are present:

```sh
ADMIN_E2E_EMAIL=e2e-reader@example.test \
ADMIN_E2E_PASSWORD='<test-only password>' \
bun run test:e2e
```

A partial credential pair or malformed email fails configuration immediately. Use only a purpose-built, least-privilege account in an isolated test environment. Do not place credentials in source control, Playwright storage-state files, command output, or production configuration. The current authenticated smoke test signs in and reads the shell; it does not create, update, invite, or delete data.

## Parity cases still required

These cases need deterministic seeded services and must be added before Solid 2 cutover:

- Invitation states: matching and mismatched sessions, existing-user login, new-user onboarding, expired/cancelled/accepted invitations, resend failure, and proof that an accepted invitation cannot restore a removed membership.
- Authorization: owner, admin, member, custom role, and multi-role navigation; direct-load denial; create-only, edit-only, blocklist-only, and set-default-only controls.
- Session lifecycle: invalid credentials, organization activation failure, logout, expired/revoked sessions, and return behavior after a protected direct load.
- Read-only route inventory: every route loaded directly and through navigation, including API/auth responses and a deliberate user-visible not-found contract.
- Mutating feature flows only against resettable fixtures: shortlinks, subscribers, lists, templates, campaigns, members, roles, and settings, including partial upstream failures.
- Accessibility: add `@axe-core/playwright` after smoke stability, then cover dialogs, tables, rich text, mobile navigation, focus restoration, and keyboard-only operation.

Unknown routes currently have a narrow parity contract: retain the requested URL, avoid 5xx/page errors, and never expose the authenticated shell. Add an explicit accessible not-found screen before tightening that assertion.
