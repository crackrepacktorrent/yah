export type InvitationStateInput = {
	invitation:
		| {
				status: string;
				expired: boolean;
				sessionMatches: boolean;
		  }
		| null
		| undefined;
	sessionEmail: string | null | undefined;
	sessionEmailVerified: boolean;
	sessionHasPassword: boolean;
	accepted: boolean;
};

export type InvitationStep =
	| 'accepted'
	| 'not-found'
	| 'canceled'
	| 'already-accepted'
	| 'invalid'
	| 'expired'
	| 'accept'
	| 'request-access'
	| 'setup-account'
	| 'wrong-account';

export function getInvitationStep(input: InvitationStateInput): InvitationStep {
	if (input.accepted) return 'accepted';
	if (!input.invitation) return 'not-found';

	if (input.invitation.status === 'canceled') return 'canceled';
	if (input.invitation.status === 'accepted') return 'already-accepted';
	if (input.invitation.status !== 'pending') return 'invalid';
	if (input.invitation.expired) return 'expired';

	if (!input.sessionEmail) return 'request-access';
	if (!input.invitation.sessionMatches) return 'wrong-account';
	if (!input.sessionEmailVerified) return 'request-access';
	return input.sessionHasPassword ? 'accept' : 'setup-account';
}
