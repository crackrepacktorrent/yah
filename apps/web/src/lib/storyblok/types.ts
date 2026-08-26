import type { SbBlokData, StoryblokRichTextNode } from '@storyblok/svelte';

/**
 * Base interface for all Storyblok blocks
 * Note: The index signature is required by Storyblok's use:storyblokEditable directive
 */
export interface StoryblokBlok extends SbBlokData {
  _uid: string;
  component: string;
  /** CSS declarations applied only to the block's outer container. */
  custom_styles?: string;
}

/**
 * Rich text field type from Storyblok
 */
export type RichTextField = StoryblokRichTextNode;

/**
 * Link field type from Storyblok
 */
export interface LinkField {
  id?: string;
  url?: string;
  cached_url?: string;
  linktype?: string;
  target?: string;
  story?: {
    id?: number;
    uuid?: string;
    slug: string;
    name: string;
    full_slug?: string;
  };
}

/**
 * Asset field type (for images, videos, etc.) from Storyblok
 */
export interface AssetField {
  filename: string;
  alt?: string;
  title?: string;
  id?: number;
  width?: number;
  height?: number;
}

/**
 * Page component - Root content type
 *
 * SEO fields (seo_title, seo_description, og_image) should be added
 * to the "page" component in the Storyblok dashboard for per-page control.
 */
export interface PageBlok extends StoryblokBlok {
  component: 'page';
  body: StoryblokBlok[];
  seo_title?: string;
  seo_description?: string;
  og_image?: AssetField;
}

/**
 * Text size options for TextSection
 */
export type TextSize = 'default' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

/** Shared editor spacing tokens. */
export type EditorSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Tokenized width choices. `default` leaves the site's existing layout alone. */
export type SectionMaxWidth = 'default' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type TextLineHeight = 'default' | 'tight' | 'normal' | 'relaxed' | 'loose';
export type ParagraphSpacing = 'default' | EditorSpacing;
export type MediaCornerRadius = 'none' | 'sm' | 'md' | 'lg';

/**
 * Text Section component
 */
export interface TextSectionBlok extends StoryblokBlok {
  component: 'text_section';
  content: RichTextField;
  text_align?: TextAlign;
  text_size?: TextSize;
  text_color?: string;
  max_width?: SectionMaxWidth;
  line_height?: TextLineHeight;
  paragraph_spacing?: ParagraphSpacing;
}

/**
 * Object fit modes for Image
 */
export type ObjectFitMode = 'none' | 'contain' | 'cover' | 'fill' | 'scale-down';

/**
 * Aspect ratio options for images
 */
export type AspectRatio =
  | 'natural'  // Natural image size
  | '1/1'      // Square
  | '16/9'     // Landscape video
  | '4/3'      // Standard photo
  | '3/2'      // Common camera ratio
  | '2/3'      // Portrait
  | '21/9';    // Ultrawide

/**
 * Object position for images - controls which part of the image is visible when cropped
 */
export type ObjectPosition =
  | 'center'       // Center (default)
  | 'top'          // Top center
  | 'bottom'       // Bottom center
  | 'left'         // Left center
  | 'right'        // Right center
  | 'top left'     // Top left corner
  | 'top right'    // Top right corner
  | 'bottom left'  // Bottom left corner
  | 'bottom right';// Bottom right corner

/**
 * Image component
 */
export interface ImageBlok extends StoryblokBlok {
  component: 'image';
  image: AssetField;
  alt_text?: string;
  caption?: string;
  lazy_loading?: boolean;
  clickable?: boolean;
  aspect_ratio?: AspectRatio;
  object_fit?: ObjectFitMode;
  object_position?: ObjectPosition;
  corner_radius?: MediaCornerRadius;
  img_custom_styles?: string;
}

/**
 * PDF spread modes
 */
export type PDFSpreadMode = 'one-page' | 'two-page-odd' | 'two-page-even';

/**
 * PDF zoom levels
 */
export type PDFZoom = 'auto' | 'page-fit' | 'page-width' | 'page-height' | 'custom';

/**
 * PDF component - embedded PDF.js viewer
 */
export interface PDFBlok extends StoryblokBlok {
  component: 'pdf';
  pdf_file: AssetField;
  title?: string;
  spread_mode?: PDFSpreadMode;
  zoom?: PDFZoom;
  custom_zoom?: number;
  initial_page?: number;
  height?: string;
  min_height?: string;
  corner_radius?: MediaCornerRadius;
}

/**
 * Video aspect ratios
 */
export type VideoAspectRatio = '16:9' | '4:3' | '21:9' | '1:1' | 'none';

/**
 * Video component
 */
export interface VideoBlok extends StoryblokBlok {
  component: 'video';
  video_url?: string;
  video_file?: AssetField;
  poster_image?: AssetField;
  aspect_ratio?: VideoAspectRatio;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  title?: string;
  corner_radius?: MediaCornerRadius;
  video_custom_styles?: string;
}

/**
 * Carousel alignment options
 */
export type CarouselAlign = 'start' | 'center' | 'end';

/**
 * Carousel component
 */
export interface CarouselBlok extends StoryblokBlok {
  component: 'carousel';
  slides: StoryblokBlok[];
  align?: CarouselAlign;
  autoplay?: boolean;
  autoplay_delay?: number;
  loop?: boolean;
  show_arrows?: boolean;
  show_dots?: boolean;
}

/**
 * Grid component - flexible CSS Grid layout container
 */
export interface GridBlok extends StoryblokBlok {
  component: 'grid';
  blocks?: StoryblokBlok[];
  column_count?: number;
  custom_template?: string;
  gap?: string;
  equal_height_rows?: boolean;
  tablet_columns?: 'inherit' | 1 | 2 | 3 | 4 | '1' | '2' | '3' | '4';
  mobile_columns?: 1 | 2 | 3 | 4 | '1' | '2' | '3' | '4';
}

/**
 * Card Grid component - searchable/sortable grid of cards
 */
export interface CardGridBlok extends StoryblokBlok {
  component: 'card_grid';
  cards?: CardBlok[];
  columns?: number;
  gap?: string;
  equal_height_rows?: boolean;
  tablet_columns?: 1 | 2 | 3 | 4 | 5 | 6 | '1' | '2' | '3' | '4' | '5' | '6';
  mobile_columns?: 1 | 2 | 3 | 4 | 5 | 6 | '1' | '2' | '3' | '4' | '5' | '6';
  full_width_cards?: boolean;
  enable_search?: boolean;
  search_placeholder?: string;
  enable_sort?: boolean;
  sort_options?: string[];
  default_sort?: string;
}


/**
 * Separator size presets
 */
export type SeparatorSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';

/**
 * Separator line styles
 */
export type SeparatorLineStyle = 'solid' | 'dashed' | 'dotted';
export type SeparatorLineColor = 'default' | 'light' | 'primary' | 'foreground';

/**
 * Separator component - unified spacer and divider
 */
export interface SeparatorBlok extends StoryblokBlok {
  component: 'separator';
  type?: 'space' | 'line';
  size?: SeparatorSize;
  custom_size?: string;
  line_style?: SeparatorLineStyle;
  line_color?: SeparatorLineColor | string;
  line_width?: string;
}


/**
 * Text alignment options
 */
export type TextAlign = 'default' | 'left' | 'center' | 'right' | 'justify';

/**
 * Section component - container for grouping components with styling
 */
export interface SectionBlok extends StoryblokBlok {
  component: 'section';
  blocks: StoryblokBlok[];
  gap?: 'default' | EditorSpacing;
  margin_top?: EditorSpacing;
  margin_bottom?: EditorSpacing;
  padding_y?: EditorSpacing;
  max_width?: SectionMaxWidth;
}


/**
 * Card metadata item
 */
export interface CardMetadataItem {
  icon?: string;
  label?: string;
  value: string;
}

/**
 * Card component - flexible card for various content types
 */
export interface CardBlok extends StoryblokBlok {
  component: 'card';

  // Image - Array of nested blocks (typically ImageBlok)
  image?: StoryblokBlok[];

  // Content
  title: string;
  description?: string;
  date?: string;

  // Metadata (flexible key-value pairs)
  metadata?: CardMetadataItem[];

  // Visual elements
  tags?: string[] | string;
  density?: 'default' | 'compact' | 'spacious';

  // Link
  link_text?: string;
  link?: LinkField;
}

/**
 * Button variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text';

/**
 * Button sizes
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Button alignment options
 */
export type ButtonAlignment = 'left' | 'center' | 'right';

/**
 * Button component - reusable link button
 */
export interface ButtonBlok extends StoryblokBlok {
  component: 'button';
  text: string;
  link: LinkField;
  variant?: ButtonVariant;
  size?: ButtonSize;
  alignment?: ButtonAlignment;
  full_width?: boolean;
}

/**
 * Social link types for footer
 */
export type SocialIconType = 'instagram' | 'twitter' | 'facebook' | 'linkedin' | 'youtube';

/**
 * Social link item for footer
 */
export interface SocialLinkBlok extends StoryblokBlok {
  component: 'social_link';
  url: string;
  icon: SocialIconType;
}

/**
 * Footer component
 */
export interface FooterBlok extends StoryblokBlok {
  component: 'footer';
  social_links?: SocialLinkBlok[];
  copyright_text?: string;
}

/**
 * Header button item
 */
export interface HeaderButtonBlok {
  _uid: string;
  text: string;
  link: LinkField;
  custom_styles?: string;
  show_dropdown?: boolean;
  /** Intentionally ignored by Header; header layout owns these dimensions. */
  size?: ButtonSize;
  /** Intentionally ignored by Header; header buttons must fit the nav row. */
  full_width?: boolean;
}

/**
 * Header component
 */
export interface HeaderBlok extends StoryblokBlok {
  component: 'header';
  buttons?: HeaderButtonBlok[];
}

/** Site-wide content stored in the reserved Storyblok `config` story. */
export interface ConfigBlok extends StoryblokBlok {
  component: 'config';
  header?: HeaderBlok[];
  footer?: FooterBlok[];
  custom_global_css?: string;
}
