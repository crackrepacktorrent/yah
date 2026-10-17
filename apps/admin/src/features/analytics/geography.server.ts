import 'server-only';
import cityLocations from './data/us-cities.json?raw';
import type { AnalyticsCity } from './contracts';

const coordinates = JSON.parse(cityLocations) as Record<string, [number, number]>;

export function locateUsCity(city: string, region: string, visitors: number): AnalyticsCity {
	const state = region.toUpperCase().replace(/^US-/, '');
	const normalized = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	return {
		label: [city || 'Unknown city', state].filter(Boolean).join(', '),
		region: state,
		visitors,
		coordinates: coordinates[`${state}:${normalized}`] ?? null,
	};
}
