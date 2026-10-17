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
});
