import 'server-only';
import { providerInvariantError } from '~/integrations/provider-contract.server';
import * as v from 'valibot';
import {
	CampaignProviderFailure,
	type CampaignContentType,
	type CampaignDetail,
	type CampaignStatus,
	type CampaignSummary,
	type CampaignType,
} from '~/features/campaigns/contracts';
import type { CampaignManager } from '~/features/campaigns/service';
import { createProviderResponseParser } from '~/integrations/provider-response.server';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, ListmonkHttpFailure, type ListmonkRequest } from './transport.server';

const MAX_CAMPAIGNS = 1_000;
const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const dateText = v.pipe(v.string(), v.check((value) => !Number.isNaN(Date.parse(value))));
const campaignTypeSchema = v.picklist(['regular', 'optin'] as const);
const campaignStatusSchema = v.picklist(['draft', 'scheduled', 'running', 'paused', 'finished', 'cancelled'] as const);
const campaignContentTypeSchema = v.picklist(['richtext', 'html', 'markdown', 'plain', 'visual'] as const);
const campaignListSchema = v.object({ id: nonNegativeInteger, name: v.string() });
const campaignMediaSchema = v.object({ id: v.nullable(positiveInteger), filename: v.string() });
const jsonObjectSchema = v.nullable(v.record(v.string(), v.unknown()));
const campaignSchema = v.object({
	id: positiveInteger,
	created_at: dateText,
	updated_at: dateText,
	uuid: v.pipe(v.string(), v.uuid()),
	type: campaignTypeSchema,
	name: v.string(),
	subject: v.string(),
	from_email: v.string(),
	body: v.string(),
	body_source: v.optional(v.nullable(v.string())),
	altbody: v.nullable(v.string()),
	send_at: v.nullable(dateText),
	started_at: v.nullable(dateText),
	status: campaignStatusSchema,
	content_type: campaignContentTypeSchema,
	tags: v.array(v.string()),
	template_id: v.nullable(positiveInteger),
	messenger: v.string(),
	headers: v.array(v.record(v.string(), v.string())),
	attribs: jsonObjectSchema,
	archive: v.boolean(),
	archive_slug: v.nullable(v.string()),
	archive_template_id: v.nullable(positiveInteger),
	archive_meta: jsonObjectSchema,
	media: v.array(campaignMediaSchema),
	views: nonNegativeInteger,
	clicks: nonNegativeInteger,
	bounces: nonNegativeInteger,
	to_send: nonNegativeInteger,
	sent: nonNegativeInteger,
	lists: v.array(campaignListSchema),
});
const campaignResponseSchema = v.object({ data: campaignSchema });
const campaignCatalogResponseSchema = v.object({
	data: v.object({
		results: v.array(campaignSchema),
		// Go zero values, not absences: PageResults has no `omitempty`, so an
		// empty catalog reports 0. The check below owns what that may mean.
		total: v.optional(nonNegativeInteger),
		per_page: v.optional(nonNegativeInteger),
		page: v.optional(nonNegativeInteger),
	}),
});
const deleteResponseSchema = v.object({ data: v.literal(true) });

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type CampaignDto = v.InferOutput<typeof campaignSchema>;
const parse = createProviderResponseParser('Listmonk');

function normalizeSummary(value: CampaignDto): CampaignSummary {
	return {
		id: value.id,
		uuid: value.uuid,
		type: value.type as CampaignType,
		name: value.name,
		subject: value.subject,
		fromEmail: value.from_email,
		messenger: value.messenger,
		status: value.status as CampaignStatus,
		contentType: value.content_type as CampaignContentType,
		templateId: value.template_id,
		sendAt: value.send_at,
		startedAt: value.started_at,
		toSend: value.to_send,
		sent: value.sent,
		views: value.views,
		clicks: value.clicks,
		bounces: value.bounces,
		lists: value.lists,
		tags: value.tags,
		createdAt: value.created_at,
		updatedAt: value.updated_at,
	};
}

function normalizeDetail(value: CampaignDto): CampaignDetail {
	return {
		...normalizeSummary(value),
		body: value.body,
	};
}

async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ListmonkHttpFailure) throw new CampaignProviderFailure(error.status);
		throw error;
	}
}

function campaignPayload(input: Parameters<CampaignManager['create']>[0] | Parameters<CampaignManager['update']>[0]) {
	return {
		name: input.name,
		subject: input.subject,
		from_email: input.fromEmail,
		lists: input.listIds,
		body: input.body,
		content_type: input.contentType,
		template_id: input.templateId,
		tags: input.tags,
		send_at: input.sendAt,
	};
}

export function createListmonkCampaignManager(config: ListmonkConfig, request?: ListmonkRequest): CampaignManager {
	const transport = createListmonkTransport(config, request);

	async function getRaw(id: number): Promise<CampaignDto | null> {
		try {
			const response = await transport.json(`/campaigns/${id}`);
			return parse(campaignResponseSchema, response, 'campaign detail').data;
		} catch (error) {
			// Listmonk v6 can report a missing valid numeric ID as either 400 or 404.
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			if (error instanceof ListmonkHttpFailure) throw new CampaignProviderFailure(error.status);
			throw error;
		}
	}

	async function get(id: number): Promise<CampaignDetail | null> {
		const campaign = await getRaw(id);
		return campaign ? normalizeDetail(campaign) : null;
	}

	return {
		async list(): Promise<CampaignSummary[]> {
			return providerCall(async () => {
				const response = parse(
					campaignCatalogResponseSchema,
					await transport.json(`/campaigns?page=1&per_page=${MAX_CAMPAIGNS}&no_body=true&order_by=created_at&order=desc`),
					'campaign catalog',
				).data;
				if (response.results.length > MAX_CAMPAIGNS || (response.total ?? 0) > MAX_CAMPAIGNS) {
					throw providerInvariantError(`Listmonk campaign catalog exceeds the ${MAX_CAMPAIGNS}-campaign safety limit.`);
				}
				if (response.results.length === 0) {
					// Listmonk returns an empty catalog before setting pagination,
					// so only total can show the provider withheld rows.
					if ((response.total ?? 0) !== 0) {
						throw providerInvariantError('Listmonk returned an incomplete campaign catalog.');
					}
				} else if (response.page !== 1 || response.per_page !== MAX_CAMPAIGNS || response.total !== response.results.length) {
					throw providerInvariantError('Listmonk returned an incomplete campaign catalog.');
				}
				const ids = response.results.map((campaign) => campaign.id);
				if (new Set(ids).size !== ids.length) throw providerInvariantError('Listmonk returned duplicate campaigns.');
				return response.results.map(normalizeSummary);
			});
		},
		get,
		async create(input): Promise<CampaignDetail> {
			return providerCall(async () => {
				const response = await transport.json('/campaigns', {
					method: 'POST',
					body: JSON.stringify({ ...campaignPayload(input), type: input.type, messenger: 'email' }),
				});
				return normalizeDetail(parse(campaignResponseSchema, response, 'created campaign').data);
			});
		},
		async update(input): Promise<CampaignDetail> {
			return providerCall(async () => {
				const current = await getRaw(input.id);
				if (!current) throw new CampaignProviderFailure(404);
				if (current.updated_at !== input.expectedUpdatedAt) throw new CampaignProviderFailure(409);
				const response = await transport.json(`/campaigns/${input.id}`, {
					method: 'PUT',
					body: JSON.stringify({
						...campaignPayload(input),
						altbody: current.altbody,
						headers: current.headers,
						attribs: current.attribs,
						messenger: current.messenger,
						archive: current.archive,
						archive_slug: current.archive_slug,
						archive_template_id: current.archive_template_id,
						archive_meta: current.archive_meta,
						body_source: current.body_source ?? null,
						media: current.media.flatMap((medium) => medium.id === null ? [] : [medium.id]),
					}),
				});
				return normalizeDetail(parse(campaignResponseSchema, response, 'updated campaign').data);
			});
		},
		async delete(ids): Promise<void> {
			await providerCall(async () => {
				const query = new URLSearchParams();
				for (const id of ids) query.append('id', String(id));
				const response = await transport.json(`/campaigns?${query.toString()}`, { method: 'DELETE' });
				parse(deleteResponseSchema, response, 'deleted campaigns');
			});
		},
		async transition(id, status): Promise<CampaignDetail> {
			return providerCall(async () => {
				const response = await transport.json(`/campaigns/${id}/status`, {
					method: 'PUT',
					body: JSON.stringify({ status }),
				});
				parse(campaignResponseSchema, response, 'campaign status');
				const current = await getRaw(id);
				if (!current) throw new CampaignProviderFailure(404);
				if (current.status !== status) throw providerInvariantError('Listmonk did not apply the requested campaign status.');
				return normalizeDetail(current);
			});
		},
		async preview(id): Promise<string> {
			return providerCall(() => transport.document(`/campaigns/${id}/preview`));
		},
	};
}
