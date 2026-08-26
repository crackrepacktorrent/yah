import { describe, expect, test } from 'bun:test';
import {
	PUBLISHED_CACHE_VERSION_TTL_MS,
	refreshPublishedCacheVersion
} from './storyblok-client';

function cacheVersionClient() {
	let clears = 0;
	return {
		client: {
			clearCacheVersion() {
				clears += 1;
			}
		},
		clears: () => clears
	};
}

describe('refreshPublishedCacheVersion', () => {
	test('clears the SDK cache version immediately and once per freshness window', () => {
		const { client, clears } = cacheVersionClient();

		refreshPublishedCacheVersion(client, 1_000);
		refreshPublishedCacheVersion(client, 1_000 + PUBLISHED_CACHE_VERSION_TTL_MS - 1);
		expect(clears()).toBe(1);

		refreshPublishedCacheVersion(client, 1_000 + PUBLISHED_CACHE_VERSION_TTL_MS);
		expect(clears()).toBe(2);
	});

	test('tracks clients independently', () => {
		const first = cacheVersionClient();
		const second = cacheVersionClient();

		refreshPublishedCacheVersion(first.client, 5_000);
		refreshPublishedCacheVersion(second.client, 5_000);

		expect(first.clears()).toBe(1);
		expect(second.clears()).toBe(1);
	});
});
