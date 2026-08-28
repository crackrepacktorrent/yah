function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		if (character === '&') return '&amp;';
		if (character === '<') return '&lt;';
		if (character === '>') return '&gt;';
		if (character === '"') return '&quot;';
		return '&#39;';
	});
}

export function subscriptionPageUrl(publicSiteUrl: string, listUuid?: string): string {
	const url = new URL('/subscribe', publicSiteUrl);
	if (listUuid) url.searchParams.set('list', listUuid);
	return url.toString();
}

export function subscriptionEmbedUrl(publicSiteUrl: string, listUuid: string): string {
	const url = new URL(subscriptionPageUrl(publicSiteUrl, listUuid));
	url.searchParams.set('embed', '1');
	return url.toString();
}

export function subscriptionEmbedSnippet(publicSiteUrl: string, listUuid: string, listName: string): string {
	return `<iframe
  src="${escapeHtml(subscriptionEmbedUrl(publicSiteUrl, listUuid))}"
  title="Subscribe to ${escapeHtml(listName)}"
  loading="lazy"
  style="width: 100%; min-height: 640px; border: 0;"
></iframe>`;
}
