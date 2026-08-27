import { StoryblokClient } from '@storyblok/js';

export type StoryblokApi = InstanceType<typeof StoryblokClient>;

type PublishedCacheState = {
	refreshAfter: number;
	refreshIntervalMs: number;
	flush?: Promise<void>;
};

const clients = new Map<string, StoryblokApi>();
const publishedCacheStates = new Map<StoryblokApi, PublishedCacheState>();

export const DEFAULT_STORYBLOK_CACHE_REFRESH_MS = 4 * 60 * 60 * 1000;

export const PUBLISHED_STORYBLOK_CACHE_OPTIONS = {
	type: 'memory',
	clear: 'manual',
	// Keep response-cache keys stable. The webhook and fallback refresh own
	// invalidation, and a cache miss without cv resolves the latest snapshot.
	cv: 'manual'
} as const;

export const DRAFT_STORYBLOK_CACHE_OPTIONS = {
	type: 'none',
	clear: 'manual',
	cv: 'manual'
} as const;

function clientKey(accessToken: string, version: 'published' | 'draft'): string {
	return `${version}:${accessToken}`;
}

function createClient(
	accessToken: string,
	version: 'published' | 'draft'
): StoryblokApi {
	const key = clientKey(accessToken, version);
	let client = clients.get(key);
	if (client) return client;

	client = new StoryblokClient({
		accessToken,
		https: true,
		region: 'eu',
		cache: version === 'published'
			? PUBLISHED_STORYBLOK_CACHE_OPTIONS
			: DRAFT_STORYBLOK_CACHE_OPTIONS
	});
	clients.set(key, client);
	return client;
}

async function flushPublishedClient(
	client: StoryblokApi,
	state: PublishedCacheState,
	now = Date.now()
): Promise<void> {
	if (state.flush) return state.flush;

	// Reset both SDK stores. This coordinates callers acquiring the shared client;
	// an already-running request is not cancelled and remains safe in its response.
	client.clearCacheVersion();
	state.flush = client.flushCache()
		.then(() => {
			state.refreshAfter = now + state.refreshIntervalMs;
		})
		.finally(() => {
			state.flush = undefined;
		});

	return state.flush;
}

/**
 * Return the shared published client after performing a bounded fallback
 * origin refresh. Storyblok publish webhooks remain the primary invalidation
 * path; this refresh prevents a missed webhook from pinning the process forever.
 */
export async function getPublishedStoryblokClient(
	accessToken: string,
	refreshIntervalMs = DEFAULT_STORYBLOK_CACHE_REFRESH_MS,
	now = Date.now()
): Promise<StoryblokApi> {
	const client = createClient(accessToken, 'published');
	let state = publishedCacheStates.get(client);

	if (!state) {
		state = {
			refreshAfter: now + refreshIntervalMs,
			refreshIntervalMs
		};
		publishedCacheStates.set(client, state);
		return client;
	}

	state.refreshIntervalMs = refreshIntervalMs;
	if (now >= state.refreshAfter) await flushPublishedClient(client, state, now);
	else if (state.flush) await state.flush;

	return client;
}

/** Draft content and Visual Editor requests must always go to Storyblok. */
export function getDraftStoryblokClient(accessToken: string): StoryblokApi {
	return createClient(accessToken, 'draft');
}

/** Flush every published response and tracked cv before purging the HTML edge cache. */
export async function flushPublishedStoryblokCaches(now = Date.now()): Promise<void> {
	await Promise.all(
		[...publishedCacheStates].map(([client, state]) => flushPublishedClient(client, state, now))
	);
}
