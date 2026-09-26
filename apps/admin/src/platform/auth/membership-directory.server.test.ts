import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMembers } = vi.hoisted(() => ({ listMembers: vi.fn() }));
vi.mock('./production-server', () => ({
	auth: { api: { listMembers } },
	canonicalOrganizationId: 'canonical-organization',
}));

import { createProductionMembershipDirectory } from './membership-directory.server';

const headers = new Headers({ cookie: 'session=fixture' });
const member = {
	id: 'member-101', userId: 'user-101', role: 'member',
	user: { name: 'Member 101', email: 'member-101@example.test' },
};

beforeEach(() => { listMembers.mockReset(); });

describe('production membership directory', () => {
	it('continues past the provider default page and keeps organization scoping', async () => {
		const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...member, id: `member-${index}` }));
		listMembers.mockResolvedValueOnce({ members: firstPage, total: 101 });
		listMembers.mockResolvedValueOnce({ members: [member], total: 101 });

		await expect(createProductionMembershipDirectory(headers).listMembers()).resolves.toEqual([...firstPage, member]);
		expect(listMembers).toHaveBeenNthCalledWith(1, {
			headers,
			query: { organizationId: 'canonical-organization', limit: 100, offset: 0, sortBy: 'id', sortDirection: 'asc' },
		});
		expect(listMembers).toHaveBeenNthCalledWith(2, {
			headers,
			query: { organizationId: 'canonical-organization', limit: 100, offset: 100, sortBy: 'id', sortDirection: 'asc' },
		});
	});

	it('looks up one member without loading the full directory', async () => {
		listMembers.mockResolvedValue({ members: [member], total: 1 });

		await expect(createProductionMembershipDirectory(headers).getMember(member.id)).resolves.toEqual(member);
		expect(listMembers).toHaveBeenCalledExactlyOnceWith({
			headers,
			query: { organizationId: 'canonical-organization', filterField: 'id', filterOperator: 'eq', filterValue: member.id, limit: 1 },
		});
	});

	it('returns null for a member outside the scoped directory', async () => {
		listMembers.mockResolvedValue({ members: [], total: 0 });
		await expect(createProductionMembershipDirectory(headers).getMember('missing')).resolves.toBeNull();
	});

	it('rejects an incomplete page instead of looping indefinitely', async () => {
		listMembers.mockResolvedValue({ members: [], total: 1 });
		await expect(createProductionMembershipDirectory(headers).listMembers()).rejects.toThrow('incomplete page');
		expect(listMembers).toHaveBeenCalledOnce();
	});

	it('bounds the directory before fetching additional pages', async () => {
		listMembers.mockResolvedValue({ members: [member], total: 10_001 });
		await expect(createProductionMembershipDirectory(headers).listMembers()).rejects.toThrow('safety limit');
		expect(listMembers).toHaveBeenCalledOnce();
	});
});
