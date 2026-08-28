import * as v from 'valibot';
import {
	CampaignAnalyticsQuerySchema,
	type CampaignAnalyticsQuery,
} from './contracts';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type CampaignAnalyticsSelection = Pick<CampaignAnalyticsQuery, 'campaignIds' | 'from' | 'to'>;

export type CampaignAnalyticsLocation = CampaignAnalyticsSelection & {
	error: string;
};

function utcCalendarDate(milliseconds: number): string {
	return new Date(milliseconds).toISOString().slice(0, 10);
}

export function defaultCampaignAnalyticsDates(now = new Date()): Pick<CampaignAnalyticsSelection, 'from' | 'to'> {
	const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return {
		from: utcCalendarDate(to - 6 * DAY_MILLISECONDS),
		to: utcCalendarDate(to),
	};
}

function queryValues(value: string | readonly string[] | undefined): readonly string[] {
	if (value === undefined) return [];
	return typeof value === 'string' ? [value] : value;
}

function parseCampaignIds(values: readonly string[]): number[] | null {
	const campaignIds: number[] = [];
	for (const value of values) {
		if (!/^[1-9]\d*$/.test(value)) return null;
		const id = Number(value);
		if (!Number.isSafeInteger(id)) return null;
		campaignIds.push(id);
	}
	return campaignIds;
}

export function decodeCampaignAnalyticsLocation(
	query: Record<string, string | readonly string[] | undefined>,
	now = new Date(),
): CampaignAnalyticsLocation {
	const defaults = defaultCampaignAnalyticsDates(now);
	const rawFrom = query['from'];
	const rawTo = query['to'];
	const from = typeof rawFrom === 'string' ? rawFrom : defaults.from;
	const to = typeof rawTo === 'string' ? rawTo : defaults.to;
	const values = queryValues(query['campaign']);
	const parsedIds = parseCampaignIds(values);
	const campaignIds = parsedIds ?? [];

	if (parsedIds === null || Array.isArray(rawFrom) || Array.isArray(rawTo)) {
		return { campaignIds, from, to, error: 'Use valid campaign and date filters.' };
	}

	// A campaign is supplied only to reuse the complete bounded date contract.
	// An empty selection is a valid initial form state, not an analytics request.
	const result = v.safeParse(CampaignAnalyticsQuerySchema, {
		campaignIds: campaignIds.length > 0 ? campaignIds : [1],
		metric: 'views',
		from,
		to,
	});
	return {
		campaignIds,
		from,
		to,
		error: result.success ? '' : result.issues[0]?.message ?? 'Use valid campaign and date filters.',
	};
}
