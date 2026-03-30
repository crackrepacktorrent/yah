import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";

export default defineConfig({
  plugins: [
    solidStart({
      // Admin panel — no public users, no SEO requirement. SPA mode eliminates
      // streaming SSR entirely, which removes the hydration mismatch class of
      // bugs that plagued the layout's createAsync session dependency.
      ssr: false,
    }),
    nitro(),
  ],
});
