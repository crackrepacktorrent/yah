import { describe, expect, test } from 'bun:test';
import { canManageMemberTarget, rolesRequireAccessControl } from './membership-policy';

describe('membership target policy', () => {
	test('derives protected targets from the canonical built-in role catalog', () => {
		expect(rolesRequireAccessControl('owner')).toBe(true);
		expect(rolesRequireAccessControl('member,editor')).toBe(true);
		expect(rolesRequireAccessControl(['admin', 'reviewer'])).toBe(true);
		expect(rolesRequireAccessControl('admin,member')).toBe(false);
	});

	test('requires mutation authority, a non-self target, and access-control visibility when protected', () => {
		expect(
			canManageMemberTarget({ isSelf: true, roles: ['member'], canMutate: true, canReadAccessControl: true }),
		).toBe(false);
		expect(
			canManageMemberTarget({ isSelf: false, roles: ['member'], canMutate: true, canReadAccessControl: false }),
		).toBe(true);
		expect(
			canManageMemberTarget({ isSelf: false, roles: ['owner'], canMutate: true, canReadAccessControl: false }),
		).toBe(false);
		expect(
			canManageMemberTarget({ isSelf: false, roles: ['editor'], canMutate: true, canReadAccessControl: false }),
		).toBe(false);
		expect(
			canManageMemberTarget({ isSelf: false, roles: ['editor'], canMutate: true, canReadAccessControl: true }),
		).toBe(true);
		expect(
			canManageMemberTarget({ isSelf: false, roles: ['member'], canMutate: false, canReadAccessControl: true }),
		).toBe(false);
	});
});
