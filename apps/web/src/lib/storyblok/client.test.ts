import { describe, expect, test } from 'bun:test';
import {
	getLinkUrl,
	getLocalizedLinkUrl,
	getSafeHttpUrl,
	getSafeUrl,
	isExternalLink,
	normalizeStorySlug
} from './client';

describe('getSafeUrl', () => {
	test('allows relative and public web URLs', () => {
		expect(getSafeUrl('/press')).toBe('/press');
		expect(getSafeUrl('https://example.com/path')).toBe('https://example.com/path');
	});

	test('rejects executable, local-file, and control-character URLs', () => {
		expect(getSafeUrl('javascript:alert(1)')).toBe('');
		expect(getSafeUrl('file:///etc/passwd')).toBe('');
		expect(getSafeUrl('https://example.com/\nattack')).toBe('');
	});

	test('restricts media sources to HTTP(S) and relative URLs', () => {
		expect(getSafeHttpUrl('https://a.storyblok.com/image.jpg')).toBe(
			'https://a.storyblok.com/image.jpg'
		);
		expect(getSafeHttpUrl('/pdfjs/web/viewer.html')).toBe('/pdfjs/web/viewer.html');
		expect(getSafeHttpUrl('mailto:hello@y4h.org')).toBe('');
	});
});

describe('getLinkUrl', () => {
	test('normalizes the Storyblok home story to the site root', () => {
		expect(getLinkUrl({ linktype: 'story', cached_url: 'home' })).toBe('/');
		expect(getLinkUrl({ linktype: 'story', cached_url: 'home?preview=1#top' })).toBe(
			'/?preview=1#top'
		);
	});

	test('normalizes story paths and preserves anchors', () => {
		expect(getLinkUrl({ linktype: 'story', cached_url: '/press/#coverage' })).toBe(
			'/press#coverage'
		);
	});

	test('creates mailto links for Storyblok email fields', () => {
		expect(getLinkUrl({ linktype: 'email', url: 'hello@y4h.org' })).toBe('mailto:hello@y4h.org');
	});

	test('returns an empty URL for missing or unsafe links', () => {
		expect(getLinkUrl()).toBe('');
		expect(getLinkUrl({ linktype: 'url', url: 'javascript:alert(1)' })).toBe('');
	});
});

describe('localized links', () => {
	test('prefixes Spanish story links and removes an existing locale', () => {
		expect(getLocalizedLinkUrl({ linktype: 'story', cached_url: 'en/press' }, 'es')).toBe(
			'/es/press'
		);
	});

	test('preserves queries and anchors while localizing story links', () => {
		expect(
			getLocalizedLinkUrl(
				{ linktype: 'story', cached_url: 'press?category=news#coverage' },
				'es'
			)
		).toBe('/es/press?category=news#coverage');
	});

	test('maps localized home links without a trailing slash', () => {
		expect(getLocalizedLinkUrl({ linktype: 'story', cached_url: 'home' }, 'es')).toBe('/es');
	});

	test('does not rewrite external links', () => {
		const link = { linktype: 'url', url: 'https://example.com/es' };
		expect(getLocalizedLinkUrl(link, 'es')).toBe(link.url);
		expect(isExternalLink(link)).toBe(true);
	});
});

describe('normalizeStorySlug', () => {
	test('normalizes locale prefixes, slashes, queries, and anchors', () => {
		expect(normalizeStorySlug('our-work/')).toBe('our-work');
		expect(normalizeStorySlug('/es/resources/?view=all#top')).toBe('resources');
	});
});
