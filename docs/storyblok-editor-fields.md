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
| Default Alignment | `text_align` | **Frontend-ready** | `left`, `center`, `right`, `justify` | Expose after confirming editors want one block-wide default in addition to per-paragraph alignment. |
| Default Text Color | `text_color` | **Frontend-ready** | Color | Prefer curated accessible theme choices over unrestricted colors. Selected rich-text colors still win. |
| Content Width | `max_width` | **Frontend-ready** | `sm`, `md`, `lg`, `xl`, `full` | Useful and low-risk; expose as a Layout field. |
| Body Line Height | `line_height` | **Proposed** | `tight`, `normal`, `relaxed`, `loose` | Implement with unitless token values before adding the schema field. |
| Paragraph Spacing | `paragraph_spacing` | **Proposed** | `none`, `sm`, `md`, `lg`, `xl` | Implement with spacing tokens before adding the schema field. |
| Content Density | `content_density` | **Proposed** | `compact`, `normal`, `spacious` | Consider this single preset before separate Heading spacing and List spacing controls. |

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

Priority fields:

- Child gap (`gap`): currently hard-coded to `1rem` in the frontend.
- Space above/below and vertical padding using shared spacing tokens.
- Maximum width.
- A curated surface/theme variant instead of independent background and text
  colors, which can create inaccessible contrast.

Do not copy every container field onto Page. Section is the intended layout
primitive, and Page-wide width/padding would create unclear precedence.

### Grid and Card Grid

**Live + working:** desktop column count/template, gap, equal-height rows; Card
Grid also has search, sorting, and card-width controls.

**Proposed:** explicit desktop/tablet/mobile columns plus separate row and column
gaps. Replace the current responsive `!important` overrides only after those
fields and migrations exist. Define whether alignment affects the grid itself or
its children; do not add an ambiguous shared `horizontal_align` field.

### Card

Prefer a small Appearance variant and Density preset over independent title
size, description size, surface, border, and padding knobs. Add image ratio or
position only where Card needs to override the nested Image block.

If a border-width preset is ever added, a nonzero value must imply a solid border
style; width and color alone do not guarantee a visible border.

### Image, Video, and PDF

**Live + working:** Image aspect ratio, object fit, object position, caption, and
separate container/media advanced fields; Video aspect ratio and playback
controls; PDF viewer size and viewing controls.

**Proposed:** media width/max width, alignment, corner radius, and accessible
caption size/spacing. Prefer a curated appearance preset to arbitrary border and
color combinations. Add PDF media-level styles only for a demonstrated iframe
use case.

### Button

**Live + working:** Size, Alignment, Full width, and Container Styles.

**Frontend-ready:** Variant (`primary`, `secondary`, `text`) is implemented but
not exposed in the current Storyblok schema.

Add icon placement and gap only if designs require them. Container Styles
correctly targets the visible button/link.

### Header and Footer

Prefer site-level theme fields for background, foreground, link, hover, spacing,
and logo sizing. Avoid per-link raw CSS because desktop and mobile navigation use
different structures.

### Carousel

`show_dots` is a **frontend gap**: it is declared in TypeScript but neither read
nor rendered, and it is not in the live schema. Implement the UI before exposing
that field, or remove the dead type.

## Rollout order

1. **Done:** Add Body Text Size and clarify Text Section Container Styles.
2. Implement and test Body Line Height and Paragraph Spacing; then expose them.
3. Expose the already-supported Text Section Content Width and, if desired,
   block-wide Alignment and curated Text Color.
4. Add Section child gap and tokenized vertical spacing.
5. Add responsive Grid/Card Grid fields and migrate away from `!important`
   breakpoint overrides.
6. Add curated Card/media appearance variants based on actual editor requests.
7. Add validated scoped CSS only after typed fields fail a demonstrated use case.

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
