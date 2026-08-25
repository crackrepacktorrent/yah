import { describe, expect, test } from 'bun:test';
import { defaultLanguage, getLanguage } from './lang';

describe('getLanguage', () => {
	test('accepts supported language codes', () => {
		expect(getLanguage('en')).toBe('en');
		expect(getLanguage('es')).toBe('es');
	});

	test('falls back for missing and unsupported codes', () => {
		expect(getLanguage()).toBe(defaultLanguage);
		expect(getLanguage('fr')).toBe(defaultLanguage);
	});
});
