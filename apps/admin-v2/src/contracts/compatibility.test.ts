import { describe, expect, test } from 'vitest';
import { parseCompatibilityCommand } from './compatibility';

describe('compatibility command', () => {
	test('trims and accepts a bounded label', () => {
		expect(parseCompatibilityCommand({ label: '  platform smoke  ' })).toEqual({ label: 'platform smoke' });
	});

	test('rejects unknown fields', () => {
		expect(() => parseCompatibilityCommand({ label: 'smoke', role: 'owner' })).toThrow();
	});
});
