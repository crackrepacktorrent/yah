The Youth Alliance for Housing (YAH) website, built with SvelteKit and Storyblok.

## Development

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd apps/web dev
```

Before committing changes, run:

```sh
bun run --cwd apps/web check
bun run --cwd apps/web lint
bun run --cwd apps/web test
bun run --cwd apps/web build
```

Copy `.env.example` to `.env` for local development. Production and preview
runtime settings are documented in `.env.production.example`. Preview tokens
are server-only: use `STORYBLOK_PREVIEW_TOKEN`, or the comma-separated
`STORYBLOK_PREVIEW_TOKENS` during rotation. A legacy
`VITE_STORYBLOK_PREVIEW_TOKEN` runtime value is accepted during migration, but
must never be passed as a build argument or accessed by client code.

## Storyblok schema ownership

The live Storyblok dashboard is the source of truth for the CMS block schema.
This repository intentionally does not keep a Storyblok CLI component export:
the previous export was incomplete, stale, and was not used by any script.

When a dashboard field or block changes, update these code sources in the same
change:

1. `src/lib/storyblok/types.ts` for the delivery API shape.
2. `src/routes/[[lang=lang]]/+layout.ts` when registering or removing a rendered block.
3. The matching component under `src/lib/components/storyblok/`.

The dashboard block names must exactly match the `component` values in the
types and the keys passed to `storyblokInit`. Run the checks above after every
schema change.

[Donate](https://www.every.org/yah?suggestedAmounts=50%2C100%2C200&theme_color=ff6f00&method=card%2Cbank%2Cpaypal%2Cpay%2Cgift%2Cdaf&designation=Website+button&min_value=2&utm_campaign=donate-link#/donate/card)
