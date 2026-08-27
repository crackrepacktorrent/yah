import { describe, expect, test } from 'bun:test';
import { StoryblokClient } from '@storyblok/js';
import {
	DRAFT_STORYBLOK_CACHE_OPTIONS,
	PUBLISHED_STORYBLOK_CACHE_OPTIONS,
	flushPublishedStoryblokCaches,
	getPublishedStoryblokClient
} from './storyblok-client';

describe('Storyblok cache configuration', () => {
	test('serves repeated published requests from memory with a stable key', async () => {
		const requests: URL[] = [];
		const mockFetch = (async (input: URL | RequestInfo) => {
			requests.push(new URL(String(input)));
			return Response.json({ story: { id: 1, content: {} }, cv: 123 });
		}) as typeof fetch;
		const client = new StoryblokClient({
			accessToken: 'published-response-cache-test',
			cache: PUBLISHED_STORYBLOK_CACHE_OPTIONS,
			fetch: mockFetch
		});

		await client.get('cdn/stories/home', { version: 'published' });
		await client.get('cdn/stories/home', { version: 'published' });
		await client.get('cdn/stories/home', { version: 'published' });

		expect(requests).toHaveLength(1);
		expect(requests.every((url) => !url.searchParams.has('cv'))).toBe(true);
	});

	test('keeps config and navigation keys distinct and refreshes both together', async () => {
		const requests: URL[] = [];
		let generation = 1;
		const mockFetch = (async (input: URL | RequestInfo) => {
			const url = new URL(String(input));
			requests.push(url);
			if (url.pathname.endsWith('/cdn/stories/config')) {
				return Response.json({
					story: { id: 1, content: { component: 'config', generation } },
					cv: generation
				});
			}
			return Response.json({
				stories: [{ id: 2, content: { component: 'page', generation } }],
				cv: generation
			});
		}) as typeof fetch;
		const client = new StoryblokClient({
			accessToken: 'published-layout-cache-test',
			cache: PUBLISHED_STORYBLOK_CACHE_OPTIONS,
			fetch: mockFetch
		});
		const configOptions = { version: 'published' as const, language: 'en' };
		const navOptions = {
			version: 'published' as const,
			language: 'en',
			by_uuids: 'navigation-story'
		};

		const firstConfig = await client.get('cdn/stories/config', { ...configOptions });
		const firstNav = await client.get('cdn/stories', { ...navOptions });
		generation = 2;
		const cachedConfig = await client.get('cdn/stories/config', { ...configOptions });
		const cachedNav = await client.get('cdn/stories', { ...navOptions });

		expect(firstConfig.data.story.content.generation).toBe(1);
		expect(firstNav.data.stories[0].content.generation).toBe(1);
		expect(cachedConfig.data.story.content.generation).toBe(1);
		expect(cachedNav.data.stories[0].content.generation).toBe(1);
		expect(requests).toHaveLength(2);

		await client.flushCache();
		const refreshedConfig = await client.get('cdn/stories/config', { ...configOptions });
		const refreshedNav = await client.get('cdn/stories', { ...navOptions });

		expect(refreshedConfig.data.story.content.generation).toBe(2);
		expect(refreshedNav.data.stories[0].content.generation).toBe(2);
		expect(requests).toHaveLength(4);
		expect(requests.filter((url) => url.pathname.endsWith('/cdn/stories/config'))).toHaveLength(2);
		expect(requests.filter((url) => url.searchParams.has('by_uuids'))).toHaveLength(2);
	});

	test('does not response-cache draft requests', async () => {
		let requests = 0;
		const mockFetch = (async (_input: URL | RequestInfo) => {
			requests += 1;
			return Response.json({ story: { id: 1, content: {} }, cv: requests });
		}) as typeof fetch;
		const client = new StoryblokClient({
			accessToken: 'draft-response-cache-test',
			cache: DRAFT_STORYBLOK_CACHE_OPTIONS,
			fetch: mockFetch
		});

		await client.get('cdn/stories/home', { version: 'draft' });
		await client.get('cdn/stories/home', { version: 'draft' });

		expect(requests).toBe(2);
	});

	test('refreshes the shared published cache on the fallback and webhook paths', async () => {
		const client = await getPublishedStoryblokClient('published-refresh-test', 100, 1_000);
		const originalFlush = client.flushCache;
		let flushes = 0;
		client.flushCache = async () => {
			flushes += 1;
			return client;
		};

		try {
			expect(await getPublishedStoryblokClient('published-refresh-test', 100, 1_099)).toBe(client);
			expect(flushes).toBe(0);

			await getPublishedStoryblokClient('published-refresh-test', 100, 1_100);
			expect(flushes).toBe(1);

			await flushPublishedStoryblokCaches(1_150);
			expect(flushes).toBe(2);
		} finally {
			client.flushCache = originalFlush;
		}
	});
});
