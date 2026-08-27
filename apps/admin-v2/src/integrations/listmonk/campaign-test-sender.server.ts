import 'server-only';
import * as v from 'valibot';
import {
	CampaignTestSendAmbiguousFailure,
	CampaignTestSendPreconditionFailure,
	isProviderTimestamp,
	SendCampaignTestCommandSchema,
	type SendCampaignTestCommand,
} from '~/features/campaign-test-sends/contracts';
import type { CampaignTestSender } from '~/features/campaign-test-sends/service';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, ListmonkHttpFailure, type ListmonkRequest } from './transport.server';

const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const dateText = v.pipe(v.string(), v.maxLength(64), v.check(isProviderTimestamp));
const campaignListSchema = v.object({ id: nonNegativeInteger });
const campaignMediaSchema = v.object({ id: v.nullable(positiveInteger) });
const campaignSchema = v.object({
	id: positiveInteger,
	updated_at: dateText,
	type: v.picklist(['regular', 'optin'] as const),
	name: v.string(),
	subject: v.string(),
	from_email: v.string(),
	body: v.string(),
	body_source: v.optional(v.nullable(v.string())),
	altbody: v.nullable(v.string()),
	status: v.picklist(['draft', 'scheduled', 'running', 'paused', 'finished', 'cancelled'] as const),
	content_type: v.picklist(['richtext', 'html', 'markdown', 'plain', 'visual'] as const),
	tags: v.array(v.string()),
	template_id: v.nullable(positiveInteger),
	messenger: v.string(),
	headers: v.array(v.record(v.string(), v.string())),
	media: v.array(campaignMediaSchema),
	lists: v.array(campaignListSchema),
});
const subscriberMembershipSchema = v.object({
	id: positiveInteger,
	status: v.picklist(['active', 'archived'] as const),
	subscription_status: v.picklist(['unconfirmed', 'confirmed', 'unsubscribed'] as const),
});
const subscriberSchema = v.object({
	id: positiveInteger,
	updated_at: dateText,
	email: v.pipe(v.string(), v.maxLength(1_000), v.email()),
	status: v.picklist(['enabled', 'disabled', 'blocklisted'] as const),
	lists: v.array(subscriberMembershipSchema),
});
const campaignResponseSchema = v.object({ data: campaignSchema });
const subscriberResponseSchema = v.object({ data: subscriberSchema });
const acceptedResponseSchema = v.strictObject({ data: v.literal(true) });
const configResponseSchema = v.object({
	data: v.object({
		messengers: v.pipe(
			v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
			v.maxLength(1_000),
			v.check((messengers) => new Set(messengers).size === messengers.length),
		),
	}),
});

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type CampaignDto = v.InferOutput<typeof campaignSchema>;
type SubscriberDto = v.InferOutput<typeof subscriberSchema>;

function requireCommand(input: unknown): SendCampaignTestCommand {
	const result = v.safeParse(SendCampaignTestCommandSchema, input);
	if (!result.success) throw new Error('Listmonk campaign test-send requires a valid command.');
	return result.output;
}

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
	endpoint: string,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw new Error(`Listmonk returned an invalid ${endpoint} response.`);
	return result.output;
}

function uniquePositiveListIds(campaign: CampaignDto): number[] {
	const ids = campaign.lists.map(({ id }) => id);
	if (ids.length === 0 || ids.some((id) => id < 1) || new Set(ids).size !== ids.length) {
		throw new Error('Listmonk returned invalid campaign list targets.');
	}
	return ids;
}

function isEmailMessenger(messenger: string): boolean {
	return messenger === 'email' || messenger.startsWith('email-');
}

function requireCampaignEligibility(campaign: CampaignDto): void {
	if (campaign.type !== 'regular') throw new CampaignTestSendPreconditionFailure('campaign-type');
	if (campaign.status !== 'draft') throw new CampaignTestSendPreconditionFailure('campaign-status');
	if (!isEmailMessenger(campaign.messenger)) throw new CampaignTestSendPreconditionFailure('campaign-messenger');
}

function requireSubscriberEligibility(subscriber: SubscriberDto, campaignListIds: readonly number[]): void {
	if (subscriber.status !== 'enabled') throw new CampaignTestSendPreconditionFailure('subscriber-status');
	const confirmedActiveLists = new Set(subscriber.lists
		.filter(({ status, subscription_status }) => status === 'active' && subscription_status === 'confirmed')
		.map(({ id }) => id));
	if (!campaignListIds.some((id) => confirmedActiveLists.has(id))) {
		throw new CampaignTestSendPreconditionFailure('subscriber-membership');
	}
}

function testPayload(campaign: CampaignDto, subscriber: SubscriberDto, listIds: number[]) {
	return {
		name: campaign.name,
		subject: campaign.subject,
		lists: listIds,
		from_email: campaign.from_email,
		messenger: campaign.messenger,
		type: 'regular',
		headers: campaign.headers,
		tags: campaign.tags,
		template_id: campaign.template_id,
		content_type: campaign.content_type,
		body: campaign.body,
		altbody: campaign.content_type === 'plain' ? null : campaign.altbody,
		body_source: campaign.body_source ?? null,
		media: campaign.media.flatMap(({ id }) => id === null ? [] : [id]),
		subscribers: [subscriber.email],
	};
}

export function createListmonkCampaignTestSender(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): CampaignTestSender {
	const transport = createListmonkTransport(config, request);

	async function getCampaign(id: number): Promise<CampaignDto | null> {
		try {
			const campaign = parse(campaignResponseSchema, await transport.json(`/campaigns/${id}`), 'campaign test-send preflight').data;
			if (campaign.id !== id) throw new Error('Listmonk returned the wrong campaign test-send target.');
			return campaign;
		} catch (error) {
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			throw error;
		}
	}

	async function getSubscriber(id: number): Promise<SubscriberDto | null> {
		try {
			const subscriber = parse(subscriberResponseSchema, await transport.json(`/subscribers/${id}`), 'subscriber test-send preflight').data;
			if (subscriber.id !== id) throw new Error('Listmonk returned the wrong subscriber test-send target.');
			const listIds = subscriber.lists.map(({ id: listId }) => listId);
			if (new Set(listIds).size !== listIds.length) throw new Error('Listmonk returned duplicate subscriber memberships.');
			return subscriber;
		} catch (error) {
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			throw error;
		}
	}

	return {
		async send(input): Promise<void> {
			const command = requireCommand(input);
			const campaign = await getCampaign(command.campaignId);
			if (!campaign) throw new CampaignTestSendPreconditionFailure('campaign-not-found');
			if (campaign.updated_at !== command.expectedCampaignUpdatedAt) {
				throw new CampaignTestSendPreconditionFailure('campaign-stale');
			}
			const campaignListIds = uniquePositiveListIds(campaign);
			requireCampaignEligibility(campaign);
			if (campaign.messenger !== 'email') {
				const activeMessengers = parse(
					configResponseSchema,
					await transport.json('/config'),
					'configuration preflight',
				).data.messengers;
				if (!activeMessengers.includes(campaign.messenger)) {
					throw new CampaignTestSendPreconditionFailure('campaign-messenger');
				}
			}
			const subscriber = await getSubscriber(command.subscriberId);
			if (!subscriber) throw new CampaignTestSendPreconditionFailure('subscriber-not-found');
			if (subscriber.updated_at !== command.expectedSubscriberUpdatedAt) {
				throw new CampaignTestSendPreconditionFailure('subscriber-stale');
			}
			requireSubscriberEligibility(subscriber, campaignListIds);

			try {
				const response = await transport.json(`/campaigns/${campaign.id}/test`, {
					method: 'POST',
					redirect: 'error',
					body: JSON.stringify(testPayload(campaign, subscriber, campaignListIds)),
				});
				const accepted = v.safeParse(acceptedResponseSchema, response);
				if (!accepted.success) throw new CampaignTestSendAmbiguousFailure();
			} catch (error) {
				if (error instanceof CampaignTestSendAmbiguousFailure) throw error;
				if (error instanceof ListmonkHttpFailure && error.status >= 400 && error.status < 500) {
					throw new CampaignTestSendPreconditionFailure('provider-rejected');
				}
				throw new CampaignTestSendAmbiguousFailure();
			}
		},
	};
}
