export function invitationCallbackPath(invitationId: string): string {
	return `/members/accept/${encodeURIComponent(invitationId)}`;
}
