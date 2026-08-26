import { describe, expect, test } from 'bun:test';
import { StoryblokClient } from '@storyblok/js';
import { STORYBLOK_CACHE_OPTIONS } from './storyblok-client';

describe('Storyblok cache configuration', () => {
	test('does not pin later requests to a previously observed content version', async () => {
		const requests: URL[] = [];
		const mockFetch = (async (input: URL | RequestInfo) => {
			requests.push(new URL(String(input)));
			return Response.json({ story: { id: 1, content: {} }, cv: 123 });
		}) as typeof fetch;
		const client = new StoryblokClient({
			accessToken: 'test-token',
			cache: STORYBLOK_CACHE_OPTIONS,
			fetch: mockFetch
		});

		await client.get('cdn/stories/home', { version: 'published' });
		await client.get('cdn/stories/home', { version: 'published' });

		expect(requests).toHaveLength(2);
		expect(requests.every((url) => !url.searchParams.has('cv'))).toBe(true);
	});
});
