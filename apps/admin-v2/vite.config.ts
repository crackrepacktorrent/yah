import { fileURLToPath } from 'node:url';
import solid from '@solidjs/vite-plugin';
import { fileRoutes } from 'filesystem-routing/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
	publicDir: 'static',
	plugins: [
		solid({
			start: {
				middleware: './src/middleware.ts',
			},
			// Keep the authenticated admin client-rendered during parity migration.
			// Re-evaluate SSR only after the Solid 2 router and feature slices are stable.
			ssr: false,
			serverFunctions: { configure: './src/server-config.ts' },
			extensions: ['.jsx', '.tsx'],
		}),
		fileRoutes({ httpMethods: true, types: true }),
	],
	resolve: {
		alias: {
			'~': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		port: 3010,
	},
	// Produce a self-contained server graph for the minimal production image.
	// Dev must let Node/Bun load CommonJS packages such as `pg`; forcing them
	// through Vite's ESM module runner leaves `require` undefined.
	...(command === 'build' ? { ssr: { noExternal: true as const } } : {}),
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/contracts/**/*.test.ts', 'src/ui/**/*.test.ts', 'src/features/**/*.test.tsx'],
				},
			},
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/features/**/*.test.ts', 'src/integrations/**/*.test.ts', 'src/platform/**/*.test.ts'],
				},
			},
		],
	},
	build: {
		assetsInlineLimit: 0,
		target: 'esnext',
	},
}));
