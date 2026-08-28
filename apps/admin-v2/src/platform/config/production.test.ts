import { describe, expect, it } from 'vitest';
import { parseProductionConfig } from './production';

const validConfig = {
	DATABASE_URL: 'postgres://yah:secret@postgres:5432/yah',
	BETTER_AUTH_SECRET: 'a-production-secret-with-32-characters',
	BETTER_AUTH_URL: 'https://admin.y4h.org/auth-path-is-normalized',
	PUBLIC_SITE_URL: 'https://y4h.org/another-path',
	LISTMONK_URL: 'https://listmonk.example',
	LISTMONK_API_TOKEN: 'listmonk-token',
	LISTMONK_ADMIN_ACCESS_TEMPLATE_ID: '1',
	LISTMONK_INVITATION_TEMPLATE_ID: '2',
	LISTMONK_PASSWORD_RESET_TEMPLATE_ID: '3',
	SHLINK_URL: 'https://shlink.example',
	SHLINK_API_KEY: 'shlink-key',
	UMAMI_URL: 'https://umami.example',
	UMAMI_USERNAME: 'umami-user',
	UMAMI_PASSWORD: 'umami-password',
	UMAMI_WEBSITE_ID: 'website-id',
};

describe('production configuration', () => {
	it('validates every current production value and normalizes origins', () => {
		const config = parseProductionConfig(validConfig);

		expect(config.BETTER_AUTH_URL).toBe('https://admin.y4h.org');
		expect(config.PUBLIC_SITE_URL).toBe('https://y4h.org');
		expect(config.LISTMONK_ADMIN_ACCESS_TEMPLATE_ID).toBe(1);
		expect(config.LISTMONK_INVITATION_TEMPLATE_ID).toBe(2);
		expect(config.LISTMONK_PASSWORD_RESET_TEMPLATE_ID).toBe(3);
	});

	it('rejects blank opaque values without changing their bytes', () => {
		const opaqueValues = {
			DATABASE_URL: ' postgres://yah:secret@postgres:5432/yah ',
			BETTER_AUTH_SECRET: ' secret-with-significant-spaces-123456 ',
			LISTMONK_API_TOKEN: ' listmonk-token ',
			SHLINK_API_KEY: ' shlink-key ',
			UMAMI_USERNAME: ' umami-user ',
			UMAMI_PASSWORD: ' umami-password ',
			UMAMI_WEBSITE_ID: ' website-id ',
		};
		const config = parseProductionConfig({ ...validConfig, ...opaqueValues });

		for (const [key, value] of Object.entries(opaqueValues)) {
			expect(config[key as keyof typeof opaqueValues]).toBe(value);
		}
		expect(() => parseProductionConfig({ ...validConfig, SHLINK_API_KEY: '   ' })).toThrow();
	});

	it('fails closed when a production value is missing', () => {
		const { DATABASE_URL: _databaseUrl, ...missingDatabase } = validConfig;
		expect(() => parseProductionConfig(missingDatabase)).toThrow();
	});

	it.each([
		['non-http origin', { BETTER_AUTH_URL: 'ftp://admin.y4h.org' }],
		['credentialed origin', { LISTMONK_URL: 'https://user:password@listmonk.example' }],
		['short auth secret', { BETTER_AUTH_SECRET: 'too-short' }],
		['zero template ID', { LISTMONK_INVITATION_TEMPLATE_ID: '0' }],
		['fractional template ID', { LISTMONK_INVITATION_TEMPLATE_ID: '1.5' }],
	])('rejects %s', (_case, override) => {
		expect(() => parseProductionConfig({ ...validConfig, ...override })).toThrow();
	});
});
