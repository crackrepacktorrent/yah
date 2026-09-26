import 'server-only';
import type { DirectoryInvitation, DirectoryMember, MembershipDirectory } from '~/features/membership/service';
import { auth, canonicalOrganizationId } from './production-server';

const MEMBER_PAGE_SIZE = 100;
const MAX_MEMBERS = 10_000;

export function createProductionMembershipDirectory(headers: Headers): MembershipDirectory {
	async function listMembers(): Promise<DirectoryMember[]> {
		const members: DirectoryMember[] = [];
		while (true) {
			const result = await auth.api.listMembers({
				headers,
				query: {
					organizationId: canonicalOrganizationId,
					limit: MEMBER_PAGE_SIZE,
					offset: members.length,
					sortBy: 'id',
					sortDirection: 'asc',
				},
			});
			if (result.total > MAX_MEMBERS) throw new Error('The member directory exceeds its safety limit.');
			members.push(...result.members as DirectoryMember[]);
			if (members.length >= result.total) return members;
			if (result.members.length === 0) throw new Error('The member directory returned an incomplete page.');
		}
	}

	return {
		listMembers,
		async getMember(memberId) {
			const result = await auth.api.listMembers({
				headers,
				query: {
					organizationId: canonicalOrganizationId,
					filterField: 'id',
					filterOperator: 'eq',
					filterValue: memberId,
					limit: 1,
				},
			});
			return result.members[0] as DirectoryMember | undefined ?? null;
		},
		async listInvitations() {
			return (await auth.api.listInvitations({
				headers,
				query: { organizationId: canonicalOrganizationId },
			})) as DirectoryInvitation[];
		},
		async listCustomRoleNames() {
			const roles = await auth.api.listOrgRoles({
				headers,
				query: { organizationId: canonicalOrganizationId },
			});
			return (roles ?? []).map((role) => role.role);
		},
		async invite(input) {
			await auth.api.createInvitation({
				headers,
				body: {
					email: input.email,
					organizationId: canonicalOrganizationId,
					role: input.roles as Array<'member'>,
					resend: input.resend,
				},
			});
		},
		async updateMemberRoles(input) {
			await auth.api.updateMemberRole({
				headers,
				body: { memberId: input.memberId, role: input.roles as Array<'member'> },
			});
		},
		async removeMembership(memberId) {
			await auth.api.removeMember({
				headers,
				body: { memberIdOrEmail: memberId, organizationId: canonicalOrganizationId },
			});
		},
		async cancelInvitation(invitationId) {
			await auth.api.cancelInvitation({
				headers,
				body: { invitationId },
			});
		},
	};
}
