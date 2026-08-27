import { describe, expect, it } from 'vitest';
import { actionLabel, permissionResourceCount, resourceLabel } from './form';

describe('role presentation helpers', () => {
	it('labels known resources and humanizes actions', () => {
		expect(resourceLabel('ac')).toBe('Roles and permissions');
		expect(resourceLabel('future-resource')).toBe('future resource');
		expect(actionLabel('set-default')).toBe('Set Default');
	});

	it('counts only resources with permissions', () => {
		expect(permissionResourceCount({ shortlink: ['view'], analytics: [], settings: ['view', 'edit'] })).toBe(2);
	});
});
