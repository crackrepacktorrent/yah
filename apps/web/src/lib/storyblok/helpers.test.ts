import { describe, expect, test } from 'bun:test';
import { getStoryblokImageDimensions } from './helpers';

describe('getStoryblokImageDimensions', () => {
	test('extracts dimensions from a Storyblok asset URL', () => {
		expect(
			getStoryblokImageDimensions(
				'https://a.storyblok.com/f/12345/1600x900/abcdef/photo.jpg'
			)
		).toEqual({ width: 1600, height: 900 });
	});

	test('returns null for transformed and non-Storyblok URLs', () => {
		expect(getStoryblokImageDimensions('https://example.com/1600x900/photo.jpg')).toBeNull();
		expect(
			getStoryblokImageDimensions('https://a.storyblok.com/f/12345/m/1600x900/photo.jpg')
		).toBeNull();
	});
});
