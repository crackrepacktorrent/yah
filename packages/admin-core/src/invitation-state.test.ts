import { describe, expect, test } from 'bun:test';
import { getInvitationStep, type InvitationStateInput } from './invitation-state';

const pendingInvitation = { status: 'pending', expired: false, sessionMatches: true };

function input(overrides: Partial<InvitationStateInput> = {}): InvitationStateInput {
	return {
		invitation: pendingInvitation,
		sessionEmail: undefined,
		sessionEmailVerified: false,
		sessionHasPassword: false,
		accepted: false,
		...overrides,
	};
}

describe('invitation state', () => {
	test('keeps anonymous and matching unverified users on mailbox verification', () => {
		expect(getInvitationStep(input())).toBe('request-access');
		expect(getInvitationStep(input({ sessionEmail: 'invited@example.test' }))).toBe('request-access');
	});

	test('requires a password before a verified matching user can accept', () => {
		expect(getInvitationStep(input({ sessionEmail: 'invited@example.test', sessionEmailVerified: true }))).toBe('setup-account');
		expect(
			getInvitationStep(
				input({ sessionEmail: 'invited@example.test', sessionEmailVerified: true, sessionHasPassword: true }),
			),
		).toBe('accept');
	});

	test('asks the wrong signed-in account to sign out without losing the invitation', () => {
		expect(
			getInvitationStep(
				input({
					sessionEmail: 'other@example.test',
					sessionEmailVerified: true,
					invitation: { ...pendingInvitation, sessionMatches: false },
				}),
			),
		).toBe('wrong-account');
	});

	test.each([
		[null, 'not-found'],
		[{ ...pendingInvitation, status: 'canceled' }, 'canceled'],
		[{ ...pendingInvitation, status: 'accepted' }, 'already-accepted'],
		[{ ...pendingInvitation, status: 'rejected' }, 'invalid'],
		[{ ...pendingInvitation, expired: true }, 'expired'],
	] as const)('maps unavailable invitation states', (invitation, expected) => {
		expect(getInvitationStep(input({ invitation }))).toBe(expected);
	});

	test('lets a successful durable acceptance win over a stale query result', () => {
		expect(getInvitationStep(input({ accepted: true, invitation: null }))).toBe('accepted');
	});
});
