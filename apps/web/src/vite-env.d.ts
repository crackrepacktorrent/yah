/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORYBLOK_PUBLIC_TOKEN?: string;
  readonly VITE_STORYBLOK_IS_PREVIEW?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_UMAMI_URL?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
