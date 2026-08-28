import { describe, expect, it } from 'vitest';
import { toLocalDateTimeValue, toShlinkDateTime } from './form';

describe('shortlink expiry conversion', () => {
	it('round-trips a provider instant through a non-UTC local input', () => {
		const local = toLocalDateTimeValue('2026-01-15T18:00:00+00:00', 360);
		expect(local).toBe('2026-01-15T12:00');
		expect(toShlinkDateTime(local, 360)).toBe('2026-01-15T18:00:00.000+00:00');
	});

	it('handles offsets on either side of UTC', () => {
		expect(toLocalDateTimeValue('2026-08-26T12:00:00+02:00', -120)).toBe('2026-08-26T12:00');
		expect(toShlinkDateTime('2026-08-26T12:00', -120)).toBe('2026-08-26T10:00:00.000+00:00');
	});
});
