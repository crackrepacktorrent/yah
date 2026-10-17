import { describe, expect, it } from 'bun:test';
import { estimatedBorough } from './borough.server';

function location(overrides: Record<string, string> = {}): Headers {
	return new Headers({
		'cf-ipcountry': 'US', 'cf-region-code': 'NY', 'cf-ipcity': 'New York City',
		'cf-postal-code': '11217', 'cf-iplatitude': '40.6848', 'cf-iplongitude': '-73.9772',
		...overrides
	});
}

describe('NYC borough inference', () => {
	it.each([
		['Manhattan', '10001', '40.7484', '-73.9857'],
		['Bronx', '10451', '40.8270', '-73.9220'],
		['Brooklyn', '11217', '40.6848', '-73.9772'],
		['Queens', '11355', '40.7610', '-73.8290'],
		['Staten Island', '10314', '40.5790', '-74.1590']
	])('labels %s as estimated only when ZIP and coordinates agree', (borough, zip, lat, lon) => {
		expect(estimatedBorough(location({ 'cf-postal-code': zip, 'cf-iplatitude': lat, 'cf-iplongitude': lon })))
			.toBe(`${borough} (estimated)`);
	});

	it('handles generic city aliases and ZIP+4 without rewriting specific places', () => {
		for (const city of ['New York', 'NYC', 'New%20York%20City']) {
			expect(estimatedBorough(location({ 'cf-ipcity': city, 'cf-region-code': 'US-NY', 'cf-postal-code': '11217-1234' })))
				.toBe('Brooklyn (estimated)');
		}
		for (const city of ['Brooklyn', 'Queens', 'Flushing', 'Newark', '']) {
			expect(estimatedBorough(location({ 'cf-ipcity': city }))).toBeNull();
		}
	});

	it('keeps missing, inconsistent, and non-NYC locations unchanged', () => {
		const inconsistent: Record<string, string>[] = [
			{ 'cf-ipcountry': 'CA' }, { 'cf-region-code': 'NJ' },
			{ 'cf-postal-code': '10001' }, { 'cf-postal-code': '11021' },
			{ 'cf-postal-code': '112171' }, { 'cf-iplatitude': '' },
			{ 'cf-iplatitude': 'Infinity' }, { 'cf-iplongitude': '-73.98' },
			{ 'cf-iplatitude': '40.7610', 'cf-iplongitude': '-73.8290' },
			{ 'cf-iplatitude': '37.7749', 'cf-iplongitude': '-122.4194' }
		];
		for (const overrides of inconsistent) expect(estimatedBorough(location(overrides))).toBeNull();
		for (const header of ['cf-ipcountry', 'cf-region-code', 'cf-ipcity', 'cf-postal-code', 'cf-iplatitude', 'cf-iplongitude']) {
			const headers = location();
			headers.delete(header);
			expect(estimatedBorough(headers)).toBeNull();
		}
	});

	it('rejects generic city-center pins, water, and shoreline coordinates', () => {
		for (const [zip, lat, lon] of [
			['10007', '40.7128', '-74.0060'],
			['10118', '40.7126', '-74.0066'],
			['11201', '40.7000', '-74.0200'],
			['11222', '40.737858', '-73.958692']
		]) expect(estimatedBorough(location({ 'cf-postal-code': zip, 'cf-iplatitude': lat, 'cf-iplongitude': lon }))).toBeNull();
	});
});
