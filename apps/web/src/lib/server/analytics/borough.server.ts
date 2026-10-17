import boroughs from './data/nyc-boroughs.json';

const byZip = new Map(boroughs.flatMap((borough) => borough.zips.map((zip) => [zip, borough] as const)));

function inRing(longitude: number, latitude: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [x, y] = ring[i];
		const [previousX, previousY] = ring[j];
		if ((y > latitude) !== (previousY > latitude) &&
			longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x) {
			inside = !inside;
		}
	}
	return inside;
}

/** Enrich only generic NYC labels; this is an IP estimate, not a measured location. */
export function estimatedBorough(headers: Headers): string | null {
	if (headers.get('cf-ipcountry') !== 'US' || !['NY', 'US-NY'].includes(headers.get('cf-region-code') ?? '')) return null;
	const city = (headers.get('cf-ipcity') ?? '').replace(/%20/gi, ' ').trim().toLowerCase();
	if (!['new york', 'new york city', 'nyc'].includes(city)) return null;
	const zip = headers.get('cf-postal-code') ?? '';
	if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return null;
	const borough = byZip.get(zip.slice(0, 5));
	if (!borough) return null;
	const lat = headers.get('cf-iplatitude') ?? '';
	const lon = headers.get('cf-iplongitude') ?? '';
	// Coarsely rounded or malformed coordinates cannot support this inference.
	if (!/^-?\d+\.\d{3,}$/.test(lat) || !/^-?\d+\.\d{3,}$/.test(lon)) return null;
	const latitude = Number(lat);
	const longitude = Number(lon);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	// Common NYC fallback points near City Hall must not turn into Manhattan.
	if (Math.abs(latitude - 40.713) < 0.003 && Math.abs(longitude + 74.006) < 0.003) return null;
	const matches = borough.polygons.some(([outer, ...holes]) =>
		inRing(longitude, latitude, outer) && !holes.some((hole) => inRing(longitude, latitude, hole))
	);
	return matches ? `${borough.name} (estimated)` : null;
}
