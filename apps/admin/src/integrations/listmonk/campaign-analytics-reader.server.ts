import 'server-only';
import * as v from 'valibot';
import {
	CampaignAnalyticsPointsSchema,
	CampaignAnalyticsQuerySchema,
	CampaignAnalyticsTimestampSchema,
	MAX_CAMPAIGN_ANALYTICS_POINTS,
	type CampaignAnalyticsPoint,
	type CampaignAnalyticsQuery,
} from '~/features/campaign-analytics/contracts';
import type { CampaignAnalyticsReader } from '~/features/campaign-analytics/service';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, type ListmonkRequest } from './transport.server';
import { providerContractError, providerInvariantError } from '~/integrations/provider-contract.server';

const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const analyticsPointSchema = v.strictObject({
	campaign_id: positiveInteger,
	count: nonNegativeInteger,
	timestamp: CampaignAnalyticsTimestampSchema,
});
const analyticsResponseSchema = v.strictObject({
	data: v.pipe(v.array(analyticsPointSchema), v.maxLength(MAX_CAMPAIGN_ANALYTICS_POINTS)),
});
const serverConfigResponseSchema = v.object({
	data: v.object({ version: v.string() }),
});

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type AnalyticsPointDto = v.InferOutput<typeof analyticsPointSchema>;

function requireQuery(input: unknown): v.InferOutput<typeof CampaignAnalyticsQuerySchema> {
	const result = v.safeParse(CampaignAnalyticsQuerySchema, input);
	if (!result.success) throw new Error('Listmonk campaign analytics requires a valid bounded query.');
	return result.output;
}

function parseResponse(input: unknown): AnalyticsPointDto[] {
	const result = v.safeParse(analyticsResponseSchema, input);
	if (!result.success) throw providerContractError('Listmonk', 'campaign analytics response', result.issues);
	return result.output.data;
}

function requireCompatibleVersion(input: unknown): void {
	const result = v.safeParse(serverConfigResponseSchema, input);
	if (!result.success) throw providerContractError('Listmonk', 'server configuration response', result.issues);
	const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(result.output.data.version);
	const version = match?.slice(1).map(Number) ?? [];
	if (!match || version.some((part) => !Number.isSafeInteger(part)) || version[0] !== 6 || (version[1] ?? 0) < 2) {
		throw providerInvariantError('Campaign analytics requires an official stable Listmonk v6.2 or newer v6 release.');
	}
}

function normalize(
	rows: readonly AnalyticsPointDto[],
	requestedCampaignIds: ReadonlySet<number>,
): CampaignAnalyticsPoint[] {
	if (rows.some((row) => !requestedCampaignIds.has(row.campaign_id))) {
		throw providerInvariantError('Listmonk returned analytics for an unrequested campaign.');
	}
	const rowKeys = rows.map((row) => `${row.campaign_id}\u0000${row.timestamp}`);
	if (new Set(rowKeys).size !== rowKeys.length) {
		throw providerInvariantError('Listmonk returned duplicate campaign analytics buckets.');
	}
	const points = rows
		.map((row) => ({ campaignId: row.campaign_id, count: row.count, timestamp: row.timestamp }))
		.sort((left, right) => {
			const timestampOrder = Date.parse(left.timestamp) - Date.parse(right.timestamp);
			return timestampOrder === 0 ? left.campaignId - right.campaignId : timestampOrder;
		});
	const result = v.safeParse(CampaignAnalyticsPointsSchema, points);
	if (!result.success) throw providerInvariantError('Listmonk returned unsafe campaign analytics values.');
	return result.output;
}

export function createListmonkCampaignAnalyticsReader(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): CampaignAnalyticsReader {
	const transport = createListmonkTransport(config, request);
	let compatibilityCheck: Promise<void> | undefined;

	async function requireCompatibleProvider(): Promise<void> {
		compatibilityCheck ??= transport.json('/config').then(requireCompatibleVersion);
		try {
			await compatibilityCheck;
		} catch (error) {
			compatibilityCheck = undefined;
			throw error;
		}
	}

	return {
		async read(input: CampaignAnalyticsQuery): Promise<CampaignAnalyticsPoint[]> {
			const query = requireQuery(input);
			await requireCompatibleProvider();
			const search = new URLSearchParams();
			for (const id of query.campaignIds) search.append('id', String(id));
			// Listmonk compares these values directly to created_at timestamps. Expand
			// the app-owned inclusive UTC calendar range so the final day is not cut
			// off at midnight.
			search.set('from', `${query.from}T00:00:00.000Z`);
			search.set('to', `${query.to}T23:59:59.999999Z`);
			const response = await transport.json(`/campaigns/analytics/${query.metric}?${search.toString()}`);
			return normalize(parseResponse(response), new Set(query.campaignIds));
		},
	};
}
