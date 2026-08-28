import 'server-only';
import { providerInvariantError } from '~/integrations/provider-contract.server';
import * as v from 'valibot';
import {
	BOUNCE_PAGE_SIZE,
	BounceSubscriberIdSchema,
	BounceTypeSchema,
	DeleteBouncesCommandSchema,
	ListBouncesQuerySchema,
	type BouncePage,
	type BounceSummary,
} from '~/features/bounces/contracts';
import type { BounceManager } from '~/features/bounces/service';
import { createProviderResponseParser } from '~/integrations/provider-response.server';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, type ListmonkRequest } from './transport.server';

const MAX_SUBSCRIBER_BOUNCES = 1_000;
const MAX_PROVIDER_TEXT_LENGTH = 2_000;
const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const boundedText = v.pipe(v.string(), v.maxLength(MAX_PROVIDER_TEXT_LENGTH));
const dateText = v.pipe(v.string(), v.check((value) => !Number.isNaN(Date.parse(value))));
const subscriberStatusSchema = v.picklist(['enabled', 'disabled', 'blocklisted'] as const);
const campaignSchema = v.strictObject({
	id: positiveInteger,
	name: boundedText,
});
const bounceSchema = v.strictObject({
	id: positiveInteger,
	type: BounceTypeSchema,
	source: boundedText,
	meta: v.record(v.string(), v.unknown()),
	created_at: dateText,
	email: v.pipe(v.string(), v.maxLength(254)),
	subscriber_uuid: v.pipe(v.string(), v.uuid()),
	subscriber_id: positiveInteger,
	subscriber_status: subscriberStatusSchema,
	campaign: v.nullable(campaignSchema),
});
const bouncePageResponseSchema = v.strictObject({
	data: v.strictObject({
		results: v.pipe(v.array(bounceSchema), v.maxLength(BOUNCE_PAGE_SIZE)),
		search: boundedText,
		query: boundedText,
		total: nonNegativeInteger,
		per_page: nonNegativeInteger,
		page: nonNegativeInteger,
	}),
});
const subscriberBouncesResponseSchema = v.strictObject({
	data: v.pipe(v.array(bounceSchema), v.maxLength(MAX_SUBSCRIBER_BOUNCES)),
});
const deleteResponseSchema = v.strictObject({ data: v.literal(true) });

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type BounceDto = v.InferOutput<typeof bounceSchema>;
const parse = createProviderResponseParser('Listmonk');

function normalize(value: BounceDto): BounceSummary {
	return {
		id: value.id,
		type: value.type,
		source: value.source,
		createdAt: value.created_at,
		email: value.email,
		campaignName: value.campaign?.name ?? null,
	};
}

function requireUniqueDescending(rows: readonly BounceDto[], endpoint: string): void {
	if (new Set(rows.map(({ id }) => id)).size !== rows.length) {
		throw providerInvariantError(`Listmonk returned duplicate rows in the ${endpoint} response.`);
	}
	for (let index = 1; index < rows.length; index += 1) {
		const previous = rows[index - 1];
		const current = rows[index];
		if (!previous || !current) throw providerInvariantError(`Listmonk returned an invalid ${endpoint} response.`);
		if (Date.parse(previous.created_at) < Date.parse(current.created_at)) {
			throw providerInvariantError(`Listmonk did not return the ${endpoint} in descending creation order.`);
		}
	}
}

function requireSubscriberId(input: unknown): number {
	const result = v.safeParse(BounceSubscriberIdSchema, input);
	if (!result.success) throw new Error('Listmonk bounce operations require a valid subscriber ID.');
	return result.output;
}

function requireBounceIds(input: unknown): number[] {
	const result = v.safeParse(DeleteBouncesCommandSchema, { ids: input });
	if (!result.success) throw new Error('Listmonk bounce deletion requires 1 to 100 unique valid IDs.');
	return result.output.ids;
}

export function createListmonkBounceManager(config: ListmonkConfig, request?: ListmonkRequest): BounceManager {
	const transport = createListmonkTransport(config, request);

	async function readPage(page: number, allowFallback: boolean): Promise<BouncePage> {
		const query = new URLSearchParams({
			page: String(page),
			per_page: String(BOUNCE_PAGE_SIZE),
			order_by: 'created_at',
			order: 'desc',
		});
		const response = parse(
			bouncePageResponseSchema,
			await transport.json(`/bounces?${query}`),
			'bounce catalog',
		).data;
		if (response.search !== '' || response.query !== '') {
			throw providerInvariantError('Listmonk unexpectedly filtered the bounce catalog response.');
		}
		requireUniqueDescending(response.results, 'bounce catalog');

		if (response.results.length === 0) {
			const zeroedEnvelope = response.total === 0 && response.per_page === 0 && response.page === 0;
			const requestedEnvelope = response.page === page && response.per_page === BOUNCE_PAGE_SIZE &&
				response.total <= (page - 1) * BOUNCE_PAGE_SIZE;
			if (!zeroedEnvelope && !requestedEnvelope) {
				throw providerInvariantError('Listmonk returned inconsistent empty bounce catalog metadata.');
			}
			if (page > 1 && allowFallback) {
				const fallback = await readPage(1, false);
				return { ...fallback, requestedPage: page };
			}
			if (page !== 1) throw providerInvariantError('Listmonk returned an out-of-range bounce page during fallback.');
			return { items: [], total: 0, page: 1, requestedPage: 1, pageSize: BOUNCE_PAGE_SIZE };
		}

		if (response.page !== page || response.per_page !== BOUNCE_PAGE_SIZE) {
			throw providerInvariantError('Listmonk did not honor the bounded bounce catalog request.');
		}
		const minimumTotal = (page - 1) * BOUNCE_PAGE_SIZE + response.results.length;
		if (response.total < minimumTotal) {
			throw providerInvariantError('Listmonk returned inconsistent bounce catalog metadata.');
		}
		return {
			items: response.results.map(normalize),
			total: response.total,
			page,
			requestedPage: page,
			pageSize: BOUNCE_PAGE_SIZE,
		};
	}

	return {
		async list(input) {
			const pageResult = v.safeParse(ListBouncesQuerySchema, input);
			if (!pageResult.success) throw new Error('Listmonk bounce listing requires a valid page.');
			return readPage(pageResult.output.page, true);
		},
		async listForSubscriber(input) {
			const subscriberId = requireSubscriberId(input);
			const response = parse(
				subscriberBouncesResponseSchema,
				await transport.json(`/subscribers/${subscriberId}/bounces`),
				'subscriber bounce catalog',
			).data;
			requireUniqueDescending(response, 'subscriber bounce catalog');
			if (response.some((bounce) => bounce.subscriber_id !== subscriberId)) {
				throw providerInvariantError('Listmonk returned another subscriber’s bounce in the subscriber bounce catalog.');
			}
			return response.map(normalize);
		},
		async delete(input) {
			const ids = requireBounceIds(input);
			const query = new URLSearchParams();
			for (const id of ids) query.append('id', String(id));
			parse(
				deleteResponseSchema,
				await transport.json(`/bounces?${query}`, { method: 'DELETE' }),
				'deleted bounces',
			);
		},
		async clearAll() {
			parse(
				deleteResponseSchema,
				await transport.json('/bounces?all=true', { method: 'DELETE' }),
				'cleared bounce catalog',
			);
		},
		async clearSubscriber(input) {
			const subscriberId = requireSubscriberId(input);
			parse(
				deleteResponseSchema,
				await transport.json(`/subscribers/${subscriberId}/bounces`, { method: 'DELETE' }),
				'cleared subscriber bounces',
			);
		},
	};
}
