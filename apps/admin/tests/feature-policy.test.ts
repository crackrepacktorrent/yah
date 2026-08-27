import { describe, expect, test } from 'bun:test';
import { can } from '../src/lib/can';
import { canAccessFeature } from '../src/lib/feature-policy';

function session(permissions: Record<string, string[]>) {
	return { permissions };
}

describe('can', () => {
	test('denies absent sessions and permissions', () => {
		expect(can(null, 'shortlink', 'view')).toBe(false);
		expect(can(session({}), 'shortlink', 'view')).toBe(false);
	});

	test('matches the requested resource and action', () => {
		const current = session({ shortlink: ['view'] });
		expect(can(current, 'shortlink', 'view')).toBe(true);
		expect(can(current, 'shortlink', 'edit')).toBe(false);
	});
});

describe('feature policies', () => {
	test('dashboard accepts either of its independently rendered data sources', () => {
		expect(canAccessFeature(session({ analytics: ['view'] }), 'dashboard')).toBe(true);
		expect(canAccessFeature(session({ shortlink: ['view'] }), 'dashboard')).toBe(true);
		expect(canAccessFeature(session({}), 'dashboard')).toBe(false);
	});

	test('campaign creation includes its required list data', () => {
		expect(canAccessFeature(
			session({ campaign: ['create'], list: ['view'] }),
			'campaignCreate',
		)).toBe(true);
		expect(canAccessFeature(session({ campaign: ['create'] }), 'campaignCreate')).toBe(false);
	});

	test('subscriber selection accepts delete or blocklist capability', () => {
		expect(canAccessFeature(
			session({ subscriber: ['blocklist'] }),
			'subscriberSelect',
		)).toBe(true);
		expect(canAccessFeature(
			session({ subscriber: ['delete'] }),
			'subscriberSelect',
		)).toBe(true);
	});

	test('create and specialized capabilities do not depend on edit', () => {
		const current = session({
			subscriber: ['create'],
			template: ['set-default'],
		});
		expect(canAccessFeature(current, 'subscriberCreate')).toBe(true);
		expect(canAccessFeature(current, 'subscriberEdit')).toBe(false);
		expect(canAccessFeature(current, 'templateSetDefault')).toBe(true);
	});

	test('list editing remains distinct from list viewing', () => {
		expect(canAccessFeature(session({ list: ['view'] }), 'lists')).toBe(true);
		expect(canAccessFeature(session({ list: ['view'] }), 'listEdit')).toBe(false);
	});

	test('roles access is independent of member creation', () => {
		expect(canAccessFeature(session({ member: ['create'] }), 'roles')).toBe(false);
		expect(canAccessFeature(session({ ac: ['read'] }), 'roles')).toBe(true);
	});

	test('members access includes both table queries', () => {
		expect(canAccessFeature(session({ member: ['create'] }), 'members')).toBe(false);
		expect(canAccessFeature(session({ invitation: ['create'] }), 'members')).toBe(false);
		expect(canAccessFeature(session({ member: ['create'], invitation: ['create'] }), 'members')).toBe(true);
	});
});
