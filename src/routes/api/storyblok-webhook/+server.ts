import { json, type RequestHandler } from '@sveltejs/kit';
import { getStoryblokApi } from '@storyblok/svelte';
import { env } from '$env/dynamic/private';

const CLOUDFLARE_ZONE_ID = env.CLOUDFLARE_ZONE_ID ?? '';
const CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_API_TOKEN ?? '';
const STORYBLOK_WEBHOOK_SECRET = env.STORYBLOK_WEBHOOK_SECRET ?? '';

export const POST: RequestHandler = async ({ request }) => {
	// Verify webhook secret
	const secret = request.headers.get('webhook-secret');
	if (!STORYBLOK_WEBHOOK_SECRET || secret !== STORYBLOK_WEBHOOK_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Flush Storyblok SDK memory cache
	try {
		const api = getStoryblokApi();
		await api.flushCache();
	} catch (e) {
		console.error('Failed to flush Storyblok cache:', e);
	}

	// Purge Cloudflare edge cache
	if (CLOUDFLARE_ZONE_ID && CLOUDFLARE_API_TOKEN) {
		try {
			await fetch(
				`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ purge_everything: true }),
				}
			);
		} catch (e) {
			console.error('Failed to purge Cloudflare cache:', e);
		}
	}

	return json({ success: true });
};
