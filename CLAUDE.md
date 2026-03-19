# CLAUDE.md

## Important: Verify current versions

Claude's training data may be stale. Before recommending or pinning specific versions of dependencies, Docker images, or services, **always verify the latest stable version** via web search or official docs. As of March 2026:
- PostgreSQL latest stable: **18.x** (not 16 or 17)
- Caddy: **2.11.x**
- Shlink: **5.x** (v5 removed QR code API, requires TRUSTED_PROXIES behind reverse proxy)
- Umami: **v3.x** (v2+ returns stats as `{value, prev}` objects, not flat numbers)
- Listmonk: **v6.x** (v6 uses token auth `Authorization: token username:token`)
- Uptime Kuma: **2.x**

## Approach to fixes and changes

- Prefer the cleanest, most maintainable solution over the simplest or quickest fix.
- Always address root causes, not symptoms.
- Favor future-proof and extensible designs.
- Large refactors are welcome when they are truly the right choice — nothing is out of scope if it leads to a better codebase.
- Do not limit changes artificially to keep scope small. If the correct fix touches many files or requires rethinking an approach, do it.

## Before writing UI code

- **Always read the component file** before using a component. Don't guess at prop types, variant values, or slot APIs.
- **Run `npx svelte-check`** after any changes to catch type errors before presenting to the user.

## Svelte 5 reactivity guidelines

### `$effect` is an escape hatch — not a synchronization tool

Per [Svelte docs](https://svelte.dev/docs/svelte/$effect#When-not-to-use-$effect), avoid `$effect` for keeping state in sync. Use `$derived` for computed values and event callbacks for state updates.

**Legitimate `$effect` uses in this codebase:**
- DOM manipulation (QRCode canvas rendering, RichTextEditor/Lexical)
- One-time initialization side effects (auto-apply filters on first data load)
- Async side effects triggered by params (accept invitation on mount)
- Cleanup/teardown (carousel event listener removal)
- Responding to navigation (auto-open sidebar collapsibles)

**Anti-pattern — do NOT do this:**
```svelte
// BAD: synchronizing state in an effect
$effect(() => {
  slug; // track slug changes
  unlocked = false; // reset state
  editTags = [...shortUrl.tags]; // sync from prop — also creates unwanted dependency on shortUrl
});
```

Instead, use `{#key}` to remount the component fresh when the key changes:
```svelte
<!-- Parent: component reinitializes when slug changes -->
{#key slug}
  <Editor {shortUrl} {slug} />
{/key}
```

### `$effect` tracking pitfalls

An `$effect` tracks **every reactive value read inside it**. Reading `shortUrl.tags` inside an effect that's meant to track `slug` will also track the entire `shortUrl` object — causing the effect to fire on unrelated prop changes (e.g., after `.refresh()`). Use `untrack()` if you must read reactive values without creating dependencies.

## Admin Component Reference (`src/lib/components/admin/`)

### Badge
- **Props:** `children: Snippet`, `variant?: 'default' | 'success' | 'error' | 'warning' | 'info'` (default: `'default'`)
- No `'primary'` variant — use `'info'` for blue-ish accent

### Breadcrumb
- **Props:** `items: { label: string; href?: string }[]`
- Last item renders as plain text; others as links

### Button
- **Props:** `children: Snippet`, `variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost'` (default: `'primary'`), `href?: string`, `disabled?: boolean`, `type?: 'submit' | 'button' | 'reset'`, `class?: string`, `onclick?`, `...rest`
- If `href` is set, renders as `<a>` instead of `<button>`

### Card
- **Props:** `children: Snippet`, `maxWidth?: string`, `class?: string`, `...rest`
- Surface bg, shadow, `1.5rem` padding, `radius-lg` corners

### ConfirmDialog
- **Props:** `open: boolean` (bindable), `title: string`, `description: string`, `confirmLabel?: string` (default: `'Confirm'`), `variant?: 'danger' | 'primary'` (default: `'danger'`), `onconfirm: () => void | Promise<void>`
- Only two variants: `danger` and `primary`
- Built on bits-ui `AlertDialog`

### EmptyState
- **Props:** `message: string`, `children?: Snippet` (optional action slot)

### FormField
- **Props:** `label: string`, `required?: boolean`, `hint?: string`, `error?: string`, `children: Snippet`
- Uses `<div role="group" aria-labelledby>` for accessibility (not `<label>` — avoids click-forwarding issues with TagInput, MultiSelect, etc.)
- Shows red `*` when required, error text takes precedence over hint
- Error state applies red border to child inputs via `:global()` selectors

### Input
- **Props:** `value?: string` (bindable), `ref?: HTMLInputElement | null` (bindable), `class?: string`, `...rest` (all HTML input attrs)
- `ref` follows the bits-ui `WithElementRef` pattern for getting the underlying element

### Logo
- **Props:** `fill?: string` (default: `'currentColor'`), `height?: number` (default: `64`)
- Width auto-calculated from aspect ratio

### BarChart
- **Props:** `bars: { x: string; y: number }[]`, `color?: string` (CSS color, default: `'var(--brand-olive)'`), `hoverColor?: string`, `formatLabel?: (x: string) => string`
- Simple vertical bar chart with hover tooltips

### QRCode
- **Props:** `url: string`, `title?: string` (default: `'qr-code'`)
- Has preset colors, dot/corner styles, logo toggle, SVG/PNG download

### Section
- **Props:** `title: string`, `children: Snippet`, `class?: string`
- Uppercase small label above content, `0.5rem` gap

### Sidebar
- **Props:** `sections: NavSection[]`, `user: { name?: string | null; email?: string | null } | null`, `onlogout: () => void`
- `NavItem = { href: string; label: string; icon: string; children?: NavItem[] }`
- `NavSection = { label: string; items: NavItem[] }`
- **Icon map keys:** `dashboard`, `link`, `chart`, `users`, `megaphone`, `mail`, `image`, `pie-chart`, `contact`, `alert-circle`, `list-checks`, `clipboard-list`, `shield` (all from lucide-svelte)
- Collapsible nav items via bits-ui `Collapsible` when `children` is set
- Mobile: drawer via bits-ui `Dialog`, breakpoint 768px

### Skeleton
- **Props:** `width?: string` (default: `'100%'`), `height?: string` (default: `'1rem'`), `radius?: string`

### Spinner
- **Props:** `size?: number` (default: `24`), `centered?: boolean` (default: `false`)

### StatCard
- **Props:** `value: string | number`, `label: string`, `accent?: string` (CSS color for top border)

### Switch
- **Props:** `checked?: boolean` (bindable), `name?: string`, `label: string`, `hint?: string`, `disabled?: boolean`
- `hint` renders as muted description text below the toggle, indented to align with the label
- Built on bits-ui `Switch`

### Table
- **Props:** `children: Snippet` (expects `<thead>`, `<tbody>`, etc.)
- Wrapped in overflow div with shadow/radius

### Tooltip
- **Props:** `text: string`, `children: Snippet`
- Built on bits-ui `Tooltip`, 300ms delay

## bits-ui components available (beyond admin wrappers)

These can be imported directly from `bits-ui` for more complex interactions:
- `Dialog`, `AlertDialog`, `Tooltip`, `Switch`, `Popover`, `Collapsible` (already used)
- `ToggleGroup`, `Toggle`, `Tabs` (already wrapped)
- `Select`, `Accordion`, etc.

## Remote function patterns

### The three primitives (from `$app/server`)

- **`query()`** — reads, returns reactive object with `.current`, `.loading`, `.error`, `.refresh()`
- **`command()`** — programmatic mutations (dialogs, button actions), returns promise
- **`form()`** — progressive enhancement with `.enhance()`, `.fields`, `.result`, `.pending`
- Don't mix: `command` has no `.fields`/`.enhance`, `form` has no direct call

### Auth wrappers (from `$lib/server/auth-helpers`)

- **`protectedQuery(permissions, [schema], fn)`** — wraps `query()` with RBAC enforcement
- **`protectedCommand(permissions, [schema], fn)`** — wraps `command()` with RBAC + error surfacing
- **`protectedForm(permissions, schema, fn)`** — wraps `form()` with RBAC + error surfacing
- All exported remote functions should use these except `getSession` (which needs no permission check)

### Data loading: `$derived(await ...)` vs `query().current`

There are two ways to consume a `query()` in a Svelte component:

**Pattern A: `$derived(await ...)`** — used by most pages
```svelte
let data = $derived(await listRoles());
let [session, data] = $derived(await Promise.all([getSession(), listFoo()]));
```
- On initial load, the layout's `<svelte:boundary>` shows a spinner until data resolves
- **`.refresh()` does NOT cause the page to re-suspend.** It updates `.current` in place. The `$derived` stays resolved and the page stays mounted. No flash.
- Reactive inputs (e.g. `$derived(await getAnalytics({ period }))` where `period` is `$state`) also update in place without flashing
- This is the default choice for page-level data loading

**Pattern B: `query().current` / `.loading` / `.error`** — used when you need granular control
```svelte
let shortUrlQuery = $derived(slug ? getShortUrl(slug) : null);
// then in template: shortUrlQuery.current, shortUrlQuery.loading, etc.
```
- The page renders immediately (no boundary suspension) and shows inline loading states
- Use when: multiple independent queries that should load/error independently, or when sub-components need the query reference for `.refresh()`
- Example: shortlink detail page has `getShortUrl(slug)` + `getShortUrlVisits(slug)` as independent queries, child components call `.refresh()` after mutations

**Both patterns are correct.** Choose based on the page's needs:
- Simple page, all data needed before render → Pattern A
- Complex page, multiple independent sections, inline loading → Pattern B

**Do NOT assume `.refresh()` causes boundary flashing.** It does not. Pages using `$derived(await ...)` with `.refresh()` after mutations work correctly — the data updates in place.

### Client-side form state: `useForm()`

`useForm()` (`$lib/utils/use-form.svelte.ts`) is a lightweight reactive form helper with Valibot validation. It is a valid fourth pattern used when:
- The form has complex reactive state (arrays, rich text, custom components) that doesn't map to native form elements
- Mutations are done via `command()` calls, not native form submission
- You need touched-field tracking and client-side validation before calling a command

Currently used by CampaignEditor. This is not redundant with `form()` — they serve different use cases. `form()` is for progressive enhancement of native HTML forms; `useForm()` is for complex client-side forms that call commands.

### Shared utilities (`$lib/utils/admin.ts`)

- `formatDuration(seconds)` — formats as "Xm Ys" or "Xs"
- `campaignStatusVariant(status)` — maps campaign status to Badge variant

### Constants (`$lib/constants.ts`)

- `ORG_SLUG` — the better-auth organization slug for this app

## Umami API response shapes

- **Stats** (`/stats`): `{ pageviews, visitors, visits, bounces, totaltime }`
- **Pageviews** (`/pageviews`): `{ pageviews: [{ x: timestamp, y: count }], sessions: [...] }`
- **Metrics** (`/metrics`): `[{ x: value, y: count }]` — types: path, referrer, browser, os, device, country, city
- **Active** (`/active`): `{ visitors: number }`
- Field is `x` for both timestamps and dimension values, `y` for counts
