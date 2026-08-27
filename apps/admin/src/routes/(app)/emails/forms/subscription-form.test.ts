import { describe, expect, test } from 'bun:test';
import { escapeHtml, getEmbedSnippet, getSubscribeUrl } from './subscription-form';

describe('subscription form helpers', () => {
	test('builds absolute subscription URLs with an encoded list ID', () => {
		expect(getSubscribeUrl('https://y4h.org', 'list / one')).toBe('https://y4h.org/subscribe?list=list+%2F+one');
		expect(getSubscribeUrl('https://y4h.org/admin/')).toBe('https://y4h.org/subscribe');
	});

	test('escapes HTML text and attribute values in embed snippets', () => {
		expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');

		const snippet = getEmbedSnippet('https://y4h.org', `list" onfocus="alert('uuid')`, '<img src=x onerror="alert(1)"> & Friends');

		expect(snippet).toMatch(/src="https:\/\/y4h\.org\/subscribe\?list=list%22\+onfocus%3D%22alert%28%27uuid%27%29"/);
		expect(snippet).toMatch(/title="Subscribe to &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Friends"/);
		expect(snippet).not.toMatch(/<img/);
	});
});
