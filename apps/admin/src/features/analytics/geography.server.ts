import 'server-only';
import cityLocations from './data/us-cities.json?raw';
import type { AnalyticsCity } from './contracts';

const coordinates = JSON.parse(cityLocations) as Record<string, [number, number]>;
const cityAliases: Record<string, string> = {
	'NY:new york': 'NY:new york city',
	'NY:nyc': 'NY:new york city',
	'NY:bronx': 'NY:the bronx',
	'NY:manhattan estimated': 'NY:manhattan',
	'NY:bronx estimated': 'NY:the bronx',
	'NY:brooklyn estimated': 'NY:brooklyn',
	'NY:queens estimated': 'NY:queens',
	'NY:staten island estimated': 'NY:staten island',
};

export function locateUsCity(city: string, region: string, visitors: number): AnalyticsCity {
	const state = region.toUpperCase().replace(/^US-/, '');
	const normalized = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	const key = `${state}:${normalized}`;
	return {
		label: [city || 'Unknown city', state].filter(Boolean).join(', '),
		region: state,
		visitors,
		coordinates: coordinates[cityAliases[key] ?? key] ?? null,
	};
}
