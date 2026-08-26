import { StoryblokClient } from '@storyblok/js';

type Client = InstanceType<typeof StoryblokClient>;

const clients = new Map<string, Client>();
const publishedCacheVersionRefreshes = new WeakMap<object, number>();

/**
 * The Storyblok SDK remembers its Content Delivery API `cv` separately from its
 * response cache. An old `cv` deliberately addresses an old published snapshot,
 * so `cache.type: 'none'` alone can leave a long-running process pinned forever
 * when a publish webhook is missed.
 */
export const PUBLISHED_CACHE_VERSION_TTL_MS = 60_000;

export function refreshPublishedCacheVersion(
	client: Pick<Client, 'clearCacheVersion'>,
	now = Date.now()
): void {
	const refreshAt = publishedCacheVersionRefreshes.get(client as object);
	if (refreshAt !== undefined && now < refreshAt) return;

	client.clearCacheVersion();
	publishedCacheVersionRefreshes.set(client as object, now + PUBLISHED_CACHE_VERSION_TTL_MS);
}

/** Create or reuse an explicitly initialized, response-cache-free server API client. */
export function getStoryblokClient(accessToken: string): Client {
	let client = clients.get(accessToken);
	if (client) return client;

	client = new StoryblokClient({
		accessToken,
		https: true,
		region: 'eu',
		cache: { clear: 'manual', type: 'none' }
	});
	clients.set(accessToken, client);
	return client;
}

export async function flushStoryblokCaches(): Promise<void> {
	await Promise.all([...clients.values()].map(async (client) => {
		await client.flushCache();
		publishedCacheVersionRefreshes.delete(client);
	}));
}
