import 'server-only';
import * as v from 'valibot';
import {
	MailingListProviderFailure,
	type MailingList,
	type MailingListKind,
	type MailingListOptIn,
	type MailingListStatus,
} from '~/features/mailing-lists/contracts';
import type { MailingListManager } from '~/features/mailing-lists/service';
import type { ProductionConfig } from '~/platform/config/production';
import {
	createListmonkTransport,
	ListmonkHttpFailure,
	type ListmonkRequest,
} from './transport.server';

const MAX_MAILING_LISTS = 1_000;
const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const dateText = v.pipe(v.string(), v.check((value) => !Number.isNaN(Date.parse(value))));
const listKindSchema = v.picklist(['public', 'private', 'temporary'] as const);
const listOptInSchema = v.picklist(['single', 'double'] as const);
const listStatusSchema = v.picklist(['active', 'archived'] as const);
const mailingListSchema = v.object({
	id: positiveInteger,
	created_at: dateText,
	updated_at: dateText,
	uuid: v.pipe(v.string(), v.uuid()),
	name: v.string(),
	type: listKindSchema,
	optin: listOptInSchema,
	status: listStatusSchema,
	description: v.string(),
	tags: v.array(v.string()),
	subscriber_count: nonNegativeInteger,
	subscriber_statuses: v.record(v.string(), nonNegativeInteger),
});
const mailingListResponseSchema = v.object({ data: mailingListSchema });
const mailingListCatalogResponseSchema = v.object({
	data: v.object({
		results: v.array(mailingListSchema),
		total: nonNegativeInteger,
		per_page: positiveInteger,
		page: positiveInteger,
	}),
});
const deleteResponseSchema = v.object({ data: v.literal(true) });

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type MailingListDto = v.InferOutput<typeof mailingListSchema>;

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
	endpoint: string,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw new Error(`Listmonk returned an invalid ${endpoint} response.`);
	return result.output;
}

function normalize(value: MailingListDto): MailingList {
	return {
		id: value.id,
		uuid: value.uuid,
		name: value.name,
		kind: value.type,
		optIn: value.optin,
		status: value.status,
		description: value.description,
		tags: value.tags,
		subscriberCount: value.subscriber_count,
		unconfirmedCount: value.subscriber_statuses['unconfirmed'] ?? 0,
		createdAt: value.created_at,
		updatedAt: value.updated_at,
	};
}

async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ListmonkHttpFailure) throw new MailingListProviderFailure(error.status);
		throw error;
	}
}

export function createListmonkMailingListManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): MailingListManager {
	const transport = createListmonkTransport(config, request);

	async function get(id: number) {
		try {
			const response = await transport.json(`/lists/${id}`);
			return normalize(parse(mailingListResponseSchema, response, 'mailing-list detail').data);
		} catch (error) {
			// Listmonk v6 can report a missing valid numeric list ID as either 400
			// or 404. No other provider failure is a nullable lookup.
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			if (error instanceof ListmonkHttpFailure) throw new MailingListProviderFailure(error.status);
			throw error;
		}
	}

	return {
		async list() {
			return providerCall(async () => {
				const response = parse(
					mailingListCatalogResponseSchema,
					await transport.json(`/lists?page=1&per_page=${MAX_MAILING_LISTS}`),
					'mailing-list catalog',
				).data;
				if (response.page !== 1 || response.per_page !== MAX_MAILING_LISTS) {
					throw new Error('Listmonk did not honor the bounded mailing-list catalog request.');
				}
				if (response.total > MAX_MAILING_LISTS || response.results.length > MAX_MAILING_LISTS) {
					throw new Error(`Listmonk mailing-list catalog exceeds the ${MAX_MAILING_LISTS}-list safety limit.`);
				}
				if (response.total !== response.results.length) {
					throw new Error('Listmonk returned an incomplete mailing-list catalog.');
				}
				return response.results.map(normalize);
			});
		},
		get,
		async create(input: {
			name: string;
			kind: Exclude<MailingListKind, 'temporary'>;
			optIn: MailingListOptIn;
			description: string;
		}) {
			return providerCall(async () => {
				const response = await transport.json('/lists', {
					method: 'POST',
					body: JSON.stringify({
						name: input.name,
						type: input.kind,
						optin: input.optIn,
						status: 'active',
						description: input.description,
						tags: [],
					}),
				});
				return normalize(parse(mailingListResponseSchema, response, 'created mailing-list').data);
			});
		},
		async update(input: {
			id: number;
			name: string;
			kind: Exclude<MailingListKind, 'temporary'>;
			optIn: MailingListOptIn;
			status: MailingListStatus;
			description: string;
			tags: string[];
		}): Promise<void> {
			await providerCall(async () => {
				const response = await transport.json(`/lists/${input.id}`, {
					method: 'PUT',
					body: JSON.stringify({
						name: input.name,
						type: input.kind,
						optin: input.optIn,
						status: input.status,
						description: input.description,
						tags: input.tags,
					}),
				});
				parse(mailingListResponseSchema, response, 'updated mailing-list');
			});
		},
		async delete(id: number): Promise<void> {
			await providerCall(async () => {
				const response = await transport.json(`/lists/${id}`, { method: 'DELETE' });
				parse(deleteResponseSchema, response, 'deleted mailing-list');
			});
		},
	};
}
