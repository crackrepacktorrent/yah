import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { validateStoryblokEditorRequest } from './storyblok-preview';

const PREVIEW_TOKEN = 'private-preview-token';
const SPACE_ID = '12345';
const NOW = 1_800_000_000;

function editorUrl(timestamp = NOW, previewToken = PREVIEW_TOKEN): URL {
	const url = new URL('https://preview.example.test/press');
	url.searchParams.set('_storyblok_tk[space_id]', SPACE_ID);
	url.searchParams.set('_storyblok_tk[timestamp]', String(timestamp));
	url.searchParams.set(
		'_storyblok_tk[token]',
		createHash('sha1').update(`${SPACE_ID}:${previewToken}:${timestamp}`).digest('hex')
	);
	return url;
}

describe('validateStoryblokEditorRequest', () => {
	test('accepts a current signature from a configured private token', () => {
		expect(validateStoryblokEditorRequest(editorUrl(), [PREVIEW_TOKEN], NOW)).toBe(PREVIEW_TOKEN);
	});

	test('supports token rotation', () => {
		expect(
			validateStoryblokEditorRequest(editorUrl(NOW, 'next-token'), [PREVIEW_TOKEN, 'next-token'], NOW)
		).toBe('next-token');
	});

	test('rejects unsigned, forged, expired, and future requests', () => {
		expect(validateStoryblokEditorRequest(new URL('https://preview.example.test/'), [PREVIEW_TOKEN], NOW)).toBeNull();
		expect(validateStoryblokEditorRequest(editorUrl(NOW, 'wrong-token'), [PREVIEW_TOKEN], NOW)).toBeNull();
		expect(validateStoryblokEditorRequest(editorUrl(NOW - 3601), [PREVIEW_TOKEN], NOW)).toBeNull();
		expect(validateStoryblokEditorRequest(editorUrl(NOW + 301), [PREVIEW_TOKEN], NOW)).toBeNull();
	});
});
