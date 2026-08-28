import 'server-only';
import type { DirectoryInvitation, DirectoryMember, MembershipDirectory } from '~/features/membership/service';
import { auth, canonicalOrganizationId } from './production-server';

export function createProductionMembershipDirectory(headers: Headers): MembershipDirectory {
	async function listMembers(): Promise<DirectoryMember[]> {
		const result = await auth.api.listMembers({
			headers,
			query: { organizationId: canonicalOrganizationId },
		});
		return result.members as DirectoryMember[];
	}

	return {
		listMembers,
		async getMember(memberId) {
			return (await listMembers()).find((member) => member.id === memberId) ?? null;
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
