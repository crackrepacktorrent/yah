import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import { createPublicError } from '~/platform/errors';
import {
	isCampaignTestSendAmbiguousFailure,
	isCampaignTestSendPreconditionFailure,
	SendCampaignTestCommandSchema,
	type SendCampaignTestCommand,
} from './contracts';

export interface CampaignTestSender {
	send(command: SendCampaignTestCommand): Promise<void>;
}

export type CampaignTestSendServiceDependencies = {
	enforcePermissions: (headers: Headers, requirement: Permissions) => Promise<void>;
	sender: CampaignTestSender;
};

function parse(input: unknown): SendCampaignTestCommand {
	const result = v.safeParse(SendCampaignTestCommandSchema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid campaign test-send request.', 400);
	return result.output;
}

function surfaceSendFailure(error: unknown): never {
	if (isCampaignTestSendAmbiguousFailure(error)) {
		throw createPublicError(
			'Listmonk may have queued this test email. Wait and check the inbox before trying again to avoid a duplicate message.',
			409,
		);
	}
	if (!isCampaignTestSendPreconditionFailure(error)) throw error;
	switch (error.reason) {
		case 'campaign-not-found': throw createPublicError('Campaign not found.', 404);
		case 'subscriber-not-found': throw createPublicError('Subscriber not found.', 404);
		case 'campaign-stale': throw createPublicError('This campaign changed after you opened it. Refresh and try again.', 409);
		case 'subscriber-stale': throw createPublicError('This subscriber changed after you opened it. Refresh and try again.', 409);
		case 'campaign-type': throw createPublicError('Only ordinary campaigns can send a test email.', 409);
		case 'campaign-status': throw createPublicError('Only draft campaigns can send a test email.', 409);
		case 'campaign-messenger': throw createPublicError('Only campaigns with an active email messenger can send a test email.', 409);
		case 'subscriber-status': throw createPublicError('Only enabled subscribers can receive a test email.', 409);
		case 'subscriber-membership': throw createPublicError('The subscriber needs an active confirmed membership on one of this campaign’s lists.', 409);
		case 'provider-rejected': throw createPublicError('Listmonk rejected the test-send request. Refresh and verify the campaign and subscriber before trying again.', 409);
	}
}

export async function sendAuthorizedCampaignTest(
	input: unknown,
	headers: Headers,
	dependencies: CampaignTestSendServiceDependencies,
): Promise<void> {
	const command = parse(input);
	await dependencies.enforcePermissions(headers, { campaign: ['send'], subscriber: ['view'] });
	try {
		await dependencies.sender.send(command);
	} catch (error) {
		surfaceSendFailure(error);
	}
}
