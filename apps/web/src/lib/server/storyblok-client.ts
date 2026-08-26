import { StoryblokClient } from '@storyblok/js';

type Client = InstanceType<typeof StoryblokClient>;

const clients = new Map<string, Client>();

export const STORYBLOK_CACHE_OPTIONS = {
	type: 'none',
	// Stable request URLs let Storyblok resolve the latest published content
	// instead of pinning this long-running server to a previously observed `cv`.
	cv: 'manual'
} as const;

/** Create or reuse an explicitly initialized, response-cache-free server API client. */
export function getStoryblokClient(accessToken: string): Client {
	let client = clients.get(accessToken);
	if (client) return client;

	client = new StoryblokClient({
		accessToken,
		https: true,
		region: 'eu',
		cache: STORYBLOK_CACHE_OPTIONS
	});
	clients.set(accessToken, client);
	return client;
}
