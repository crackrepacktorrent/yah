import { timingSafeEqual } from 'node:crypto';
import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const PURGE_TIMEOUT_MS = 8_000;

function secretMatches(provided: string | undefined, expected: string): boolean {
	if (!provided || !expected) return false;
	const left = Buffer.from(provided);
	const right = Buffer.from(expected);
	return left.length === right.length && timingSafeEqual(left, right);
}

export const POST: RequestHandler = async ({ params }) => {
	if (!secretMatches(params.secret, env.STORYBLOK_WEBHOOK_SECRET ?? '')) {
		return json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
	}

	const zoneId = env.CLOUDFLARE_ZONE_ID ?? '';
	const apiToken = env.CLOUDFLARE_API_TOKEN ?? '';
	if (Boolean(zoneId) !== Boolean(apiToken)) {
		console.error('Cloudflare cache purge is partially configured');
		return json({ error: 'Cloudflare cache purge is misconfigured' }, { status: 500, headers: NO_STORE });
	}

	if (zoneId && apiToken) {
		let response: Response;
		try {
			response = await fetch(
				`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ purge_everything: true }),
					signal: AbortSignal.timeout(PURGE_TIMEOUT_MS)
				}
			);
		} catch (reason) {
			console.error('Cloudflare cache purge request failed', reason);
			return json({ error: 'Cloudflare cache purge failed' }, { status: 502, headers: NO_STORE });
		}

		const result = await response.json().catch(() => null) as { success?: boolean } | null;
		if (!response.ok || result?.success !== true) {
			console.error('Cloudflare cache purge was rejected', { status: response.status });
			return json({ error: 'Cloudflare cache purge failed' }, { status: 502, headers: NO_STORE });
		}
	}

	return json({ success: true }, { headers: NO_STORE });
};
