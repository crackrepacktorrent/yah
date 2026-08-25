import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_SIGNATURE_AGE_SECONDS = 60 * 60;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function parseSignature(value: string | null): Buffer | null {
	if (!value || !/^[a-f\d]{40}$/i.test(value)) return null;
	return Buffer.from(value, 'hex');
}

/**
 * Return the preview token that signed a Storyblok Visual Editor request.
 * Tokens are accepted as an array to support zero-downtime token rotation.
 */
export function validateStoryblokEditorRequest(
	url: URL,
	previewTokens: string[],
	nowSeconds = Math.floor(Date.now() / 1000)
): string | null {
	const spaceId = url.searchParams.get('_storyblok_tk[space_id]');
	const timestampValue = url.searchParams.get('_storyblok_tk[timestamp]');
	const signature = parseSignature(url.searchParams.get('_storyblok_tk[token]'));
	const timestamp = Number(timestampValue);

	if (
		!spaceId ||
		!/^\d+$/.test(spaceId) ||
		!timestampValue ||
		!Number.isSafeInteger(timestamp) ||
		!signature ||
		timestamp < nowSeconds - MAX_SIGNATURE_AGE_SECONDS ||
		timestamp > nowSeconds + MAX_CLOCK_SKEW_SECONDS
	) {
		return null;
	}

	for (const token of previewTokens) {
		const expected = createHash('sha1')
			.update(`${spaceId}:${token}:${timestampValue}`)
			.digest();

		if (expected.length === signature.length && timingSafeEqual(expected, signature)) {
			return token;
		}
	}

	return null;
}
