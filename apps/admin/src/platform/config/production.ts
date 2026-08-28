import * as v from 'valibot';

const opaqueText = v.pipe(
	v.string(),
	v.check((value) => value.trim().length > 0, 'Expected a non-blank value.'),
);
const trimmedText = v.pipe(v.string(), v.trim(), v.minLength(1));
const origin = v.pipe(
	trimmedText,
	v.url(),
	v.transform((value) => {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
			throw new Error('Expected an HTTP(S) origin without credentials.');
		}
		return url.origin;
	}),
);
const positiveInteger = v.pipe(
	trimmedText,
	v.regex(/^\d+$/),
	v.transform(Number),
	v.safeInteger(),
	v.minValue(1),
);

const productionConfigSchema = v.object({
	DATABASE_URL: opaqueText,
	BETTER_AUTH_SECRET: v.pipe(opaqueText, v.minLength(32)),
	BETTER_AUTH_URL: origin,
	PUBLIC_SITE_URL: origin,
	LISTMONK_URL: origin,
	LISTMONK_API_TOKEN: opaqueText,
	LISTMONK_ADMIN_ACCESS_TEMPLATE_ID: positiveInteger,
	LISTMONK_INVITATION_TEMPLATE_ID: positiveInteger,
	LISTMONK_PASSWORD_RESET_TEMPLATE_ID: positiveInteger,
	SHLINK_URL: origin,
	SHLINK_API_KEY: opaqueText,
	UMAMI_URL: origin,
	UMAMI_USERNAME: opaqueText,
	UMAMI_PASSWORD: opaqueText,
	UMAMI_WEBSITE_ID: opaqueText,
});

export type ProductionConfig = v.InferOutput<typeof productionConfigSchema>;

/** Validate the complete current-admin runtime contract only in production mode. */
export function parseProductionConfig(input: unknown): ProductionConfig {
	return v.parse(productionConfigSchema, input);
}
