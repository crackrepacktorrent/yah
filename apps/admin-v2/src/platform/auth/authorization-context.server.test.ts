import { beforeEach, describe, expect, it, vi } from 'vitest';

const production = vi.hoisted(() => ({
	getSession: vi.fn(),
	hasPermission: vi.fn(),
	findMember: vi.fn(),
}));

vi.mock('./production-server', () => ({
	canonicalOrganizationId: 'organization-one',
	auth: {
		api: {
			getSession: production.getSession,
			hasPermission: production.hasPermission,
		},
		$context: Promise.resolve({ adapter: { findOne: production.findMember } }),
	},
}));

import { createAuthorizationContext } from './authorization.server';

describe('createAuthorizationContext', () => {
	beforeEach(() => {
		production.getSession.mockReset();
		production.hasPermission.mockReset();
		production.findMember.mockReset();
		production.getSession.mockResolvedValue({
			user: { id: 'user-one', emailVerified: true },
			session: { activeOrganizationId: 'organization-one' },
		});
		production.findMember.mockResolvedValue({ id: 'member-one', role: 'owner' });
		production.hasPermission.mockResolvedValue({ success: true });
	});

	it('memoizes the canonical session across context operations', async () => {
		const authorization = createAuthorizationContext(new Headers({ cookie: 'session=one' }));

		await expect(authorization.getCurrentUserId()).resolves.toBe('user-one');
		await authorization.requirePermissions({ settings: ['view'] });
		await expect(authorization.getCurrentUserId()).resolves.toBe('user-one');

		expect(production.getSession).toHaveBeenCalledTimes(1);
		expect(production.findMember).toHaveBeenCalledTimes(1);
	});

	it('checks each atomic Better Auth grant only once, including concurrent requests', async () => {
		const authorization = createAuthorizationContext(new Headers({ cookie: 'session=one' }));

		await Promise.all([
			authorization.requirePermissions({ settings: ['view', 'view'], analytics: ['view'] }),
			authorization.requirePermissions({ settings: ['view'] }),
		]);

		expect(production.hasPermission).toHaveBeenCalledTimes(2);
		expect(production.hasPermission.mock.calls.map(([input]) => input.body.permissions)).toEqual([
			{ settings: ['view'] },
			{ analytics: ['view'] },
		]);
	});

	it('starts distinct atomic Better Auth checks in parallel', async () => {
		let release!: (value: { success: true }) => void;
		const providerResponse = new Promise<{ success: true }>((resolve) => {
			release = resolve;
		});
		production.hasPermission.mockReturnValue(providerResponse);
		const authorization = createAuthorizationContext(new Headers({ cookie: 'session=one' }));

		const checking = authorization.requirePermissions({ campaign: ['create'], list: ['view'] });
		await vi.waitFor(() => expect(production.hasPermission).toHaveBeenCalledTimes(2));
		release({ success: true });
		await checking;
	});

	it('keeps a rejected atomic grant authoritative for the invocation', async () => {
		production.hasPermission.mockResolvedValue({ success: false, error: 'Denied' });
		const authorization = createAuthorizationContext(new Headers({ cookie: 'session=one' }));

		await expect(authorization.requirePermissions({ settings: ['edit'] })).rejects.toMatchObject({ status: 403 });
		await expect(authorization.requirePermissions({ settings: ['edit'] })).rejects.toMatchObject({ status: 403 });
		expect(production.hasPermission).toHaveBeenCalledTimes(1);
	});
});
