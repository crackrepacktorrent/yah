export interface CardGridItem {
	title?: string;
	description?: string;
	date?: string;
	tags?: string[] | string | null;
}

export interface CardGridQuery {
	query?: string;
	sortBy?: string;
}

/** Normalize both the existing array shape and Storyblok comma-separated text. */
export function normalizeCardTags(tags: CardGridItem['tags']): string[] {
	const values = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [];
	return values.map((tag) => tag.trim()).filter(Boolean);
}

function normalizeSortKey(value: string): 'title' | 'date' | 'tags' | '' {
	if (value === 'category') return 'tags';
	if (value === 'title' || value === 'date' || value === 'tags') return value;
	return '';
}

function dateTimestamp(value: string | undefined): number {
	if (!value) return 0;
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Filter and sort cards without mutating Storyblok's content array.
 * `category` remains a compatibility alias for the frontend's `tags` field.
 */
export function filterAndSortCards<T extends CardGridItem>(
	cards: readonly T[] | null | undefined,
	{ query = '', sortBy = '' }: CardGridQuery = {}
): T[] {
	const normalizedQuery = query.toLowerCase();
	let items = [...(cards ?? [])];

	if (normalizedQuery) {
		items = items.filter((item) => {
			const searchText = [
				item.title,
				item.description,
				normalizeCardTags(item.tags).join(' ')
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return searchText.includes(normalizedQuery);
		});
	}

	const sortKey = normalizeSortKey(sortBy);
	if (sortKey === 'title') {
		items.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
	} else if (sortKey === 'tags') {
		items.sort((a, b) =>
			(normalizeCardTags(a.tags)[0] ?? '').localeCompare(normalizeCardTags(b.tags)[0] ?? '')
		);
	} else if (sortKey === 'date') {
		items.sort((a, b) => dateTimestamp(b.date) - dateTimestamp(a.date));
	}

	return items;
}
