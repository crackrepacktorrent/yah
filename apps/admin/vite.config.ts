import { defineConfig } from 'vite';
import { nitro } from 'nitro/vite';
import { solidStart } from '@solidjs/start/config';

export default defineConfig({
	plugins: [
		solidStart({
			// Preserve CSR through the Solid 2 parity migration: the authenticated
			// admin has no SEO requirement. Re-evaluate SSR separately afterward;
			// route groups weakened the original hydration-mismatch rationale.
			ssr: false,
		}),
		nitro(),
	],
});
