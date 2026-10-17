import { describe, expect, it } from 'vitest';
import { locateUsCity } from './geography.server';

describe('US city coordinates', () => {
	it('normalizes punctuation, accents, and state prefixes without guessing a state', () => {
		expect(locateUsCity('St. Louis', 'US-MO', 5).coordinates).not.toBeNull();
		expect(locateUsCity('St. Louis', 'US-MO', 5).coordinates).toEqual(locateUsCity('St Louis', 'MO', 5).coordinates);
		expect(locateUsCity('San José', 'US-CA', 5).coordinates).toEqual([-121.895, 37.339]);
		expect(locateUsCity('Austin', '', 5).coordinates).toBeNull();
	});

	it('preserves counts when a city is missing or cannot be located', () => {
		expect(locateUsCity('Unlisted town', 'US-TX', 8)).toEqual({ label: 'Unlisted town, TX', region: 'TX', visitors: 8, coordinates: null });
		expect(locateUsCity('', '', 3)).toEqual({ label: 'Unknown city', region: '', visitors: 3, coordinates: null });
	});

	it('maps inferred boroughs while retaining the estimate label and counts', () => {
		for (const borough of ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']) {
			const result = locateUsCity(`${borough} (estimated)`, 'US-NY', 7);
			expect(result).toEqual({ label: `${borough} (estimated), NY`, region: 'NY', visitors: 7, coordinates: locateUsCity(borough, 'NY', 7).coordinates });
			expect(result.coordinates).not.toBeNull();
		}
		expect(locateUsCity('Brooklyn (estimated)', 'NJ', 7).coordinates).toBeNull();
	});

	it('locates NYC aliases without merging boroughs or assuming New York state', () => {
		const city = locateUsCity('New York City', 'NY', 8).coordinates;
		expect(locateUsCity('New York', 'US-NY', 8)).toEqual({ label: 'New York, NY', region: 'NY', visitors: 8, coordinates: city });
		expect(locateUsCity('NYC', 'NY', 8).coordinates).toEqual(city);
		expect(locateUsCity('Bronx', 'US-NY', 3).coordinates).toEqual(locateUsCity('The Bronx', 'NY', 3).coordinates);
		const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].map((name) => locateUsCity(name, 'NY', 1).coordinates);
		expect(boroughs.every((point) => point !== null)).toBe(true);
		expect(new Set(boroughs.map((point) => JSON.stringify(point))).size).toBe(5);
		expect(locateUsCity('New York', '', 8).coordinates).toBeNull();
		expect(locateUsCity('Bronx', 'NJ', 3).coordinates).toBeNull();
	});
});
