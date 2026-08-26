/**
 * Shared, editor-facing design tokens.
 *
 * Storyblok stores stable option names while the frontend owns their CSS
 * values. Unset, `default`, and unknown values intentionally resolve to
 * `undefined` so existing content continues to use each component's CSS
 * defaults.
 */
export const textSizeValues = {
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem'
} as const;

export const textAlignValues = {
  left: 'left',
  center: 'center',
  right: 'right'
} as const;

export const lineHeightValues = {
  tight: '1.35',
  normal: '1.5',
  relaxed: '1.75',
  loose: '2'
} as const;

export const spacingValues = {
  none: '0',
  xs: 'var(--space-1)',
  sm: 'var(--space-2)',
  md: 'var(--space-4)',
  lg: 'var(--space-8)',
  xl: 'var(--space-12)'
} as const;

/** Paragraph spacing deliberately uses the same site spacing scale. */
export const paragraphSpacingValues = spacingValues;

export const maxWidthValues = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  full: '100%'
} as const;

export const radiusValues = {
  none: '0',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)'
} as const;

export function getEditorToken(
  options: Readonly<Record<string, string>>,
  value: unknown
): string | undefined {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(options, value)) {
    return undefined;
  }

  return options[value];
}
