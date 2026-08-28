import { describe, expect, it } from 'vitest';
import { subscriptionEmbedSnippet, subscriptionEmbedUrl, subscriptionPageUrl } from './subscription-sharing';

describe('subscription sharing', () => {
	it('builds absolute standalone and list-scoped embed URLs', () => {
		expect(subscriptionPageUrl('https://www.example.test/admin/')).toBe('https://www.example.test/subscribe');
		expect(subscriptionPageUrl('https://www.example.test', 'list / one')).toBe(
			'https://www.example.test/subscribe?list=list+%2F+one',
		);
		expect(subscriptionEmbedUrl('https://www.example.test', 'list / one')).toBe(
			'https://www.example.test/subscribe?list=list+%2F+one&embed=1',
		);
	});

	it('escapes generated iframe attributes and scopes the embedded catalog', () => {
		const snippet = subscriptionEmbedSnippet(
			'https://www.example.test',
			`list" onfocus="alert('uuid')`,
			'<img src=x onerror="alert(1)"> & Friends',
		);
		expect(snippet).toContain('embed=1');
		expect(snippet).toContain('title="Subscribe to &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Friends"');
		expect(snippet).not.toContain('<img');
	});
});
