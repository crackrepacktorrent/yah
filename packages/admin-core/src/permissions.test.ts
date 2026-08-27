import { describe, expect, test } from 'bun:test';
import {
	customRoleStatements,
	isCustomRolePermissionResource,
	pickCustomRolePermissions,
} from './permissions';

describe('custom role permission boundary', () => {
	test('exposes only product resources to custom roles', () => {
		expect(Object.keys(customRoleStatements)).toEqual([
			'shortlink',
			'template',
			'subscriber',
			'list',
			'bounce',
			'campaign',
			'analytics',
			'settings',
		]);
		for (const resource of ['organization', 'member', 'invitation', 'team', 'ac', 'constructor', '__proto__']) {
			expect(isCustomRolePermissionResource(resource)).toBe(false);
		}
	});

	test('clones only known product actions from built-in or stale role data', () => {
		expect(
			pickCustomRolePermissions({
				organization: ['delete'],
				member: ['create'],
				ac: ['read'],
				shortlink: ['view', 'view', 'delete', 'invented'],
				analytics: ['view'],
			}),
		).toEqual({ shortlink: ['view', 'delete'], analytics: ['view'] });
	});
});
