import { describe, expect, test } from 'bun:test';
import { filterAndSortCards, normalizeCardTags } from './card-grid';

const cards = [
	{
		title: 'Zulu',
		description: 'Tenant organizing',
		date: '2025-01-15',
		tags: ['Housing', 'Youth']
	},
	{
		title: 'Alpha',
		description: 'Public workshop',
		date: '2026-03-10',
		tags: 'Education, Events'
	},
	{
		title: 'No Date',
		description: 'General information',
		date: 'not-a-date',
		tags: ''
	}
];

describe('normalizeCardTags', () => {
	test('preserves arrays while trimming empty values', () => {
		expect(normalizeCardTags([' Housing ', '', 'Youth'])).toEqual(['Housing', 'Youth']);
	});

	test('splits comma-separated Storyblok text', () => {
		expect(normalizeCardTags('Education, Events,  ')).toEqual(['Education', 'Events']);
	});
});

describe('filterAndSortCards', () => {
	test('searches titles, descriptions, and either tag representation case-insensitively', () => {
		expect(filterAndSortCards(cards, { query: 'tenant' }).map((card) => card.title)).toEqual([
			'Zulu'
		]);
		expect(filterAndSortCards(cards, { query: 'EVENTS' }).map((card) => card.title)).toEqual([
			'Alpha'
		]);
	});

	test('sorts titles without mutating the source array', () => {
		const originalOrder = cards.map((card) => card.title);
		expect(filterAndSortCards(cards, { sortBy: 'title' }).map((card) => card.title)).toEqual([
			'Alpha',
			'No Date',
			'Zulu'
		]);
		expect(cards.map((card) => card.title)).toEqual(originalOrder);
	});

	test('sorts dates newest-first and leaves invalid dates last', () => {
		expect(filterAndSortCards(cards, { sortBy: 'date' }).map((card) => card.title)).toEqual([
			'Alpha',
			'Zulu',
			'No Date'
		]);
	});

	test('treats legacy category sorting as tags sorting', () => {
		const tagsOrder = filterAndSortCards(cards, { sortBy: 'tags' }).map((card) => card.title);
		const categoryOrder = filterAndSortCards(cards, { sortBy: 'category' }).map(
			(card) => card.title
		);
		expect(categoryOrder).toEqual(tagsOrder);
		expect(tagsOrder).toEqual(['No Date', 'Alpha', 'Zulu']);
	});

	test('preserves filtered order for default and unknown sort values', () => {
		expect(filterAndSortCards(cards, { sortBy: 'default' }).map((card) => card.title)).toEqual(
			cards.map((card) => card.title)
		);
		expect(filterAndSortCards(cards, { sortBy: 'unknown' }).map((card) => card.title)).toEqual(
			cards.map((card) => card.title)
		);
	});
});
