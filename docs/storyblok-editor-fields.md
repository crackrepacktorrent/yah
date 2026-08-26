# Storyblok editor styling fields

This inventory separates controls that work today from controls that still need
frontend implementation. It is not a schema file to push wholesale.

## Status labels

- **Live + working:** present in Storyblok and consumed by the frontend.
- **Frontend-ready:** consumed by the frontend but not exposed in Storyblok.
- **Proposed:** needs frontend implementation and tests before a schema field is
  added.
- **Frontend gap:** declared or exposed somewhere, but not fully implemented.

## Styling contract

`custom_styles` is an advanced escape hatch containing CSS declarations for a
block's outer container. It does not accept selectors or braces and does not
promise to restyle internal component parts. Use this Storyblok label and help
text consistently:

**Container Styles (advanced)**

> CSS declarations for this block's outer container. Example:
> `margin-bottom: 2rem; background: white`. Use the block's editor fields for
> text, spacing, layout, and media. Selectors and `{}` rules are not supported.

Common presentation choices belong in typed fields backed by shared frontend
tokens. This keeps responsive behavior intentional and avoids coupling content
to frontend class names.

Do not overload `custom_styles` with nested-rule syntax. If arbitrary nested
styling becomes a demonstrated requirement, add a separate, validated
`scoped_css` field with `&` for the current block and stable
`data-style-part` hooks. This requires a parser, scope rewriting, security
review, and tests before any schema rollout.

### Known contract exceptions

- Header mobile-sheet content is portaled outside the Header root, so inherited
  Header container declarations do not reach all mobile content.
- Header Button styles target different compound elements on desktop and mobile.
- `SocialLinkBlok` and Config inherit the TypeScript base field even though they
  do not render their own `custom_styles`; narrow that type in a future cleanup.
- Image and Video intentionally have separate advanced media fields in addition
  to their container field.

Card Grid now follows the outer-container contract in the working tree. An audit
of all 15 draft stories found no non-empty Card Grid `custom_styles`, so the
target change does not migrate existing YAH content. Grid-specific layout must
remain in typed Grid fields.

## Rich-text responsibilities

Do not duplicate choices editors already apply to selected rich text: heading
level, bold/emphasis, lists, blockquotes, links, text color, highlight color, and
individual paragraph alignment.

Block-level fields below are defaults for the whole body-copy context. Selected
rich-text formatting wins. Baseline styling for blockquotes, code, tables, and
other rich-text elements belongs in global frontend CSS, not in editor fields.

## Text Section

| Editor field | Technical name | Status | Values | Recommendation |
| --- | --- | --- | --- | --- |
| Body Text Size | `text_size` | **Live + working** | `default`, `sm`, `base`, `lg`, `xl`, `2xl` | **Use Site Typography** preserves the standard element-specific paragraph/list/blockquote sizes. Explicit sizes apply uniformly to all body copy; headings retain their rich-text level. |
| Content Width | `max_width` | **Live + working** | `default`, `sm`, `md`, `lg`, `xl`, `full` | Constrained widths are centered; **Use Site Layout** is a compatibility no-op. |
| Body Line Height | `line_height` | **Live + working** | `default`, `tight`, `normal`, `relaxed`, `loose` | Explicit choices use unitless shared tokens across paragraphs, lists, and blockquotes. |
| Paragraph Spacing | `paragraph_spacing` | **Live + working** | `default`, `none`, `xs`, `sm`, `md`, `lg`, `xl` | Controls paragraph margins without adding space after the final paragraph. |
| Default Alignment | `text_align` | **Frontend-ready** | `left`, `center`, `right` | Intentionally not exposed because individual paragraph alignment already exists in rich text. |
| Default Text Color | `text_color` | **Frontend-ready** | Color | Do not expose an unrestricted picker; use a future curated accessible tone field if needed. |

Do not expose arbitrary font families by default. Typography is part of the site
identity. Add Letter spacing or Text transform only for a recurring content
pattern rather than as general-purpose controls.

The Text Section typography context preserves existing blocks exactly:
paragraphs remain 1.125rem/2rem, while lists and blockquotes remain at their
existing 1rem default. Once an editor explicitly selects a Body Text Size,
paragraphs, lists, and blockquotes use that selected size. Headings retain their
rich-text levels. The default option is labelled **Use Site Typography** so its
behavior does not depend on ambiguous references to the "current" design.

## Minimal fields by component

### Section

**Live + working:** Child Gap, Content Width, Space Above, Space Below, and
Vertical Padding use shared tokens. Defaults preserve the former hard-coded
1rem child gap and add no width, margin, or padding constraints.

Defer a surface/theme variant until paired background and foreground choices are
tested with every nested component.

Do not copy every container field onto Page. Section is the intended layout
primitive, and Page-wide width/padding would create unclear precedence.

### Grid and Card Grid

**Live + working:** desktop/tablet/mobile columns, gap, and equal-height rows;
Card Grid also has search, sorting, and card-width controls. Responsive columns
now use CSS variables instead of `!important`. Grid tablet layout may inherit its
desktop template; compatibility defaults retain the former breakpoints.

The historical Card Grid `category` sort value is retained as a compatibility
alias for Tags. Cards accept comma-separated Tags / Categories, and search and
sorting normalize both the historical array shape and the editor text shape.
Do not add ambiguous grid/child alignment controls.

### Card

**Live + working:** Tags / Categories and Content Density (`default`, `compact`,
`spacious`). Prefer a future curated Appearance variant over independent title
size, description size, surface, border, and padding knobs. Image ratio and
position remain owned by the nested Image block.

If a border-width preset is ever added, a nonzero value must imply a solid border
style; width and color alone do not guarantee a visible border.

### Image, Video, and PDF

**Live + working:** Image aspect ratio, object fit, object position, caption, and
separate container/media advanced fields; Video aspect ratio and playback
controls; PDF viewer size and viewing controls.

**Live + working:** tokenized Corner Radius for Image, Video, and PDF. Video also
exposes its translatable Accessible Title. Media width/alignment remain deferred
until nested Card and Carousel behavior is designed and tested. Add PDF
media-level styles only for a demonstrated iframe use case.

### Button

**Live + working:** Appearance (`primary`, `secondary`, `text`), Size, Alignment,
Full Width, and Container Styles.

Add icon placement and gap only if designs require them. Container Styles
correctly targets the visible button/link.

### Header and Footer

Prefer site-level theme fields for background, foreground, link, hover, spacing,
and logo sizing. Avoid per-link raw CSS because desktop and mobile navigation use
different structures.

### Carousel

**Live + working:** optional localized, keyboard-accessible slide dots report the
current slide and jump through the existing carousel API. The compatibility
default is off.

### Page and Separator

Page exposes translatable SEO Title and Description plus an optional Social
Sharing Image; existing frontend fallbacks remain unchanged. Page-wide layout
fields stay intentionally absent because Section owns layout.

Separator is now an available nestable component with typed spacer/divider
controls. Its line colors use site design tokens; custom size and container CSS
remain advanced options.

## Preview reliability

- Published Storyblok cache-version state is refreshed at least every 60
  seconds, so a missed webhook cannot pin the preview process to an old content
  snapshot indefinitely.
- Internal Header navigation preserves only the signed Storyblok editor request
  parameters, keeping page, dropdown, logo, and language navigation in draft
  mode without forwarding editor UI state.
- Config has a live Header/Footer bridge. Global CSS continues to update only
  through a reload because it must pass server-side validation.

## Rollout order

1. **Done:** Text body size, width, line height, and paragraph spacing.
2. **Done:** Section spacing/width and responsive Grid/Card Grid columns.
3. **Done:** Card tags/density, Button appearance, media radius, Carousel dots,
   Page SEO, Video accessible title, and Separator.
4. Design paired accessible surface/text themes before adding color controls.
5. Design and test nested media width/alignment before exposing those controls.
6. Add validated scoped CSS only after typed fields fail a demonstrated use case.

Group schema fields into Content, Layout, Appearance, and Advanced sections when
Storyblok configuration permits it. Styling fields should not be translatable.

## Change record

### 2026-08-26

- Confirmed YAH uses Storyblok's EU region and space `285809308059110`.
- Added `text_size` to the live `text_section` schema as **Body Text Size**, with
  **Use Site Typography** plus `sm`, `base`, `lg`, `xl`, and `2xl`. The default
  preserves the website's standard element-specific body-copy sizes.
- Relabelled Text Section `custom_styles` as **Container Styles (advanced)** and
  documented its outer-container-only contract.
- Re-pulled the live schema and verified the new field and generated field ID.
- Replaced Text Section's property-specific custom-style detection with a
  body-copy typography context based on CSS inheritance while preserving the
  existing paragraph, list, and blockquote defaults.
- Standardized Card Grid `custom_styles` on the block's outer container after
  verifying all 15 draft stories contain no Card Grid custom-style values.
- Completed an independent second-agent review and incorporated its status,
  compatibility, accessibility, and rollout recommendations.
- Frontend verification: `svelte-check` reported zero errors/warnings; 23 related
  tests and the production build passed.
- Added a shared, whitelisted editor-token layer. Added Text Section width/line
  height/paragraph spacing and Section gap/margin/padding/width with no-op
  compatibility defaults.
- Added responsive Grid and Card Grid columns without `!important`; made the
  stored `category` Card Grid sort value a working Tags alias.
- Added Card tags/density, Button appearance, Image/Video/PDF radius, Video
  accessible title, accessible Carousel dots, Page SEO fields, and Separator.
- Standardized advanced-style labels/help and added schema bounds matching
  frontend clamps.
- Fixed stale preview snapshots, signed draft navigation, and Config
  Header/Footer live updates.
- Broader frontend verification: `svelte-check`, ESLint, 43 web tests,
  production build, and `git diff --check` passed.
