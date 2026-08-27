import { describe, expect, test } from 'bun:test';
import { isPrintedQrShortCode, PRINTED_QR_SHORT_CODES } from './shortlink-policy';

describe('printed QR shortlink policy', () => {
	test('protects every printed short code', () => {
		expect(PRINTED_QR_SHORT_CODES).toHaveLength(7);
		for (const shortCode of PRINTED_QR_SHORT_CODES) {
			expect(isPrintedQrShortCode(shortCode)).toBe(true);
		}
	});

	test('does not broaden the case-sensitive protection set', () => {
		expect(isPrintedQrShortCode('Signup')).toBe(false);
		expect(isPrintedQrShortCode('ordinary-link')).toBe(false);
	});

	test('keeps the legacy y4h.org Caddy matcher synchronized', async () => {
		const caddyfile = await Bun.file(new URL('../../../infra/caddy/Caddyfile', import.meta.url)).text();
		const site = caddyfile.match(/^y4h\.org, www\.y4h\.org \{(?<body>[\s\S]*?)^admin\.y4h\.org \{/m)?.groups?.['body'];
		expect(site).toBeDefined();
		const matcher = site?.match(/^\s*@shortlink path (?<paths>.+)$/m)?.groups?.['paths'];
		expect(matcher).toBeDefined();
		const shortCodes = matcher?.split(/\s+/).map((path) => path.replace(/^\//, '')).sort();
		expect(shortCodes).toEqual([...PRINTED_QR_SHORT_CODES].sort());
		expect(site).toMatch(/handle @shortlink \{\s*reverse_proxy shlink:8080\s*\}/);
	});
});
