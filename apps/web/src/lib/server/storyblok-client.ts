import { StoryblokClient } from '@storyblok/js';

type Client = InstanceType<typeof StoryblokClient>;

const clients = new Map<string, Client>();

/** Create or reuse an explicitly initialized, cache-free server API client. */
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
	await Promise.all([...clients.values()].map((client) => client.flushCache()));
}
