export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return character;
		}
	});
}

export function getSubscribeUrl(publicSiteUrl: string, listUuid?: string): string {
	const url = new URL('/subscribe', publicSiteUrl);
	if (listUuid !== undefined) url.searchParams.set('list', listUuid);
	return url.toString();
}

export function getEmbedSnippet(publicSiteUrl: string, listUuid: string, listName: string): string {
	const source = escapeHtml(getSubscribeUrl(publicSiteUrl, listUuid));
	const safeListName = escapeHtml(listName);

	// An iframe keeps the POST same-origin with the public web application.
	// A plain cross-origin form is rejected by SvelteKit's production CSRF check.
	return `<iframe
  src="${source}"
  title="Subscribe to ${safeListName}"
  loading="lazy"
  style="width: 100%; min-height: 640px; border: 0;"
></iframe>`;
}
