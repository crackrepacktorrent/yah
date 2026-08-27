import { describe, expect, it, vi } from 'vitest';
import {
	CampaignTestSendAmbiguousFailure,
	CampaignTestSendPreconditionFailure,
	type CampaignTestSendPrecondition,
	type SendCampaignTestCommand,
} from './contracts';
import {
	sendAuthorizedCampaignTest,
	type CampaignTestSendServiceDependencies,
} from './service';

const validCommand: SendCampaignTestCommand = {
	campaignId: 21,
	expectedCampaignUpdatedAt: '2026-08-25T11:00:00Z',
	subscriberId: 31,
	expectedSubscriberUpdatedAt: '2026-08-25T12:00:00Z',
};

function dependencies(): CampaignTestSendServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		sender: { send: vi.fn(async () => undefined) },
	};
}

const publicFailures: ReadonlyArray<{
	reason: CampaignTestSendPrecondition;
	status: number;
	message: string;
}> = [
	{ reason: 'campaign-not-found', status: 404, message: 'Campaign not found.' },
	{ reason: 'subscriber-not-found', status: 404, message: 'Subscriber not found.' },
	{ reason: 'campaign-stale', status: 409, message: 'This campaign changed after you opened it. Refresh and try again.' },
	{ reason: 'subscriber-stale', status: 409, message: 'This subscriber changed after you opened it. Refresh and try again.' },
	{ reason: 'campaign-type', status: 409, message: 'Only ordinary campaigns can send a test email.' },
	{ reason: 'campaign-status', status: 409, message: 'Only draft campaigns can send a test email.' },
	{ reason: 'campaign-messenger', status: 409, message: 'Only campaigns with an active email messenger can send a test email.' },
	{ reason: 'subscriber-status', status: 409, message: 'Only enabled subscribers can receive a test email.' },
	{ reason: 'subscriber-membership', status: 409, message: 'The subscriber needs an active confirmed membership on one of this campaign’s lists.' },
	{ reason: 'provider-rejected', status: 409, message: 'Listmonk rejected the test-send request. Refresh and verify the campaign and subscriber before trying again.' },
];

describe('campaign test-send service boundary', () => {
	it('enforces the exact campaign:send and subscriber:view requirement before one sender call', async () => {
		const deps = dependencies();
		const headers = new Headers({ cookie: 'session=owner' });

		await expect(sendAuthorizedCampaignTest(validCommand, headers, deps)).resolves.toBeUndefined();
		expect(deps.enforcePermissions).toHaveBeenCalledOnce();
		expect(deps.enforcePermissions).toHaveBeenCalledWith(headers, {
			campaign: ['send'],
			subscriber: ['view'],
		});
		expect(deps.sender.send).toHaveBeenCalledOnce();
		expect(deps.sender.send).toHaveBeenCalledWith(validCommand);
		expect(vi.mocked(deps.enforcePermissions).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(deps.sender.send).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
	});

	it('rejects malformed public input before authorization or provider access', async () => {
		const invalidInputs = [
			{ ...validCommand, campaignId: 0 },
			{ ...validCommand, subscriberId: 1.5 },
			{ ...validCommand, expectedCampaignUpdatedAt: 'not-a-date' },
			{ ...validCommand, unexpected: true },
		];

		for (const input of invalidInputs) {
			const deps = dependencies();
			await expect(sendAuthorizedCampaignTest(input, new Headers(), deps)).rejects.toMatchObject({
				name: 'PublicError',
				status: 400,
			});
			expect(deps.enforcePermissions).not.toHaveBeenCalled();
			expect(deps.sender.send).not.toHaveBeenCalled();
		}
	});

	it('does not reach Listmonk when either required permission is denied', async () => {
		const deps = dependencies();
		vi.mocked(deps.enforcePermissions).mockRejectedValue(new Error('Forbidden'));

		await expect(sendAuthorizedCampaignTest(validCommand, new Headers(), deps)).rejects.toThrow('Forbidden');
		expect(deps.enforcePermissions).toHaveBeenCalledOnce();
		expect(deps.sender.send).not.toHaveBeenCalled();
	});

	it.each(publicFailures)('maps $reason to a diagnostic-free $status public error', async ({ reason, status, message }) => {
		const deps = dependencies();
		vi.mocked(deps.sender.send).mockRejectedValue(new CampaignTestSendPreconditionFailure(reason));

		await expect(sendAuthorizedCampaignTest(validCommand, new Headers(), deps)).rejects.toMatchObject({
			name: 'PublicError',
			status,
			message,
		});
		expect(deps.sender.send).toHaveBeenCalledOnce();
	});

	it('maps an ambiguous acknowledgement to duplicate-safe retry guidance', async () => {
		const deps = dependencies();
		vi.mocked(deps.sender.send).mockRejectedValue(new CampaignTestSendAmbiguousFailure());

		await expect(sendAuthorizedCampaignTest(validCommand, new Headers(), deps)).rejects.toMatchObject({
			name: 'PublicError',
			status: 409,
			message: 'Listmonk may have queued this test email. Wait and check the inbox before trying again to avoid a duplicate message.',
		});
		expect(deps.sender.send).toHaveBeenCalledOnce();
	});

	it('propagates unexpected and forged failure objects instead of reporting a false success', async () => {
		for (const failure of [
			new Error('transport setup failed'),
			{ name: 'CampaignTestSendPreconditionFailure', reason: 'invented-reason' },
		]) {
			const deps = dependencies();
			vi.mocked(deps.sender.send).mockRejectedValue(failure);

			await expect(sendAuthorizedCampaignTest(validCommand, new Headers(), deps)).rejects.toBe(failure);
			expect(deps.sender.send).toHaveBeenCalledOnce();
		}
	});
});
