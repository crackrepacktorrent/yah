import * as v from 'valibot';

export const MAX_CAMPAIGN_ANALYTICS_IDS = 100;
export const MAX_CAMPAIGN_ANALYTICS_SPAN_DAYS = 366;
export const MAX_CAMPAIGN_ANALYTICS_POINTS =
	MAX_CAMPAIGN_ANALYTICS_IDS * (MAX_CAMPAIGN_ANALYTICS_SPAN_DAYS + 1);

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const calendarDatePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const timestampPattern =
	/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function calendarDateMilliseconds(value: string): number {
	return Date.parse(`${value}T00:00:00.000Z`);
}

function isRealCalendarDate(value: string): boolean {
	if (!calendarDatePattern.test(value)) return false;
	const milliseconds = calendarDateMilliseconds(value);
	return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
}

const campaignId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid campaign.'));
const calendarDate = v.pipe(
	v.string(),
	v.regex(calendarDatePattern, 'Use a date in YYYY-MM-DD format.'),
	v.check(isRealCalendarDate, 'Use a real calendar date.'),
);
const timestamp = v.pipe(
	v.string(),
	v.maxLength(64),
	v.regex(timestampPattern),
	v.check((value) => isRealCalendarDate(value.slice(0, 10))),
	v.check((value) => Number.isFinite(Date.parse(value))),
);
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

export const CampaignAnalyticsMetricSchema = v.picklist(['views', 'clicks'] as const);
export const CampaignAnalyticsTimestampSchema = timestamp;
export const CampaignAnalyticsQuerySchema = v.pipe(
	v.strictObject({
		campaignIds: v.pipe(
			v.array(campaignId),
			v.minLength(1, 'Select at least one campaign.'),
			v.maxLength(
				MAX_CAMPAIGN_ANALYTICS_IDS,
				`Select at most ${MAX_CAMPAIGN_ANALYTICS_IDS} campaigns.`,
			),
			v.check((values) => new Set(values).size === values.length, 'Select each campaign only once.'),
		),
		metric: CampaignAnalyticsMetricSchema,
		from: calendarDate,
		to: calendarDate,
	}),
	v.check(
		(query) => calendarDateMilliseconds(query.from) <= calendarDateMilliseconds(query.to),
		'The start date must not be after the end date.',
	),
	v.check(
		(query) =>
			calendarDateMilliseconds(query.to) - calendarDateMilliseconds(query.from) <=
			MAX_CAMPAIGN_ANALYTICS_SPAN_DAYS * DAY_MILLISECONDS,
		`Select start and end dates at most ${MAX_CAMPAIGN_ANALYTICS_SPAN_DAYS} days apart.`,
	),
);

export const CampaignAnalyticsPointSchema = v.strictObject({
	campaignId,
	count,
	timestamp: CampaignAnalyticsTimestampSchema,
});
export const CampaignAnalyticsPointsSchema = v.pipe(
	v.array(CampaignAnalyticsPointSchema),
	v.maxLength(MAX_CAMPAIGN_ANALYTICS_POINTS),
);

export type CampaignAnalyticsMetric = v.InferOutput<typeof CampaignAnalyticsMetricSchema>;
export type CampaignAnalyticsQuery = v.InferInput<typeof CampaignAnalyticsQuerySchema>;
export type CampaignAnalyticsPoint = v.InferOutput<typeof CampaignAnalyticsPointSchema>;
export type CampaignAnalyticsBucket = Pick<CampaignAnalyticsPoint, 'timestamp' | 'count'>;

/** Combine campaign series without leaking a chart-library-specific `{ x, y }` shape. */
export function aggregateCampaignAnalyticsByTimestamp(
	points: readonly CampaignAnalyticsPoint[],
): CampaignAnalyticsBucket[] {
	const counts = new Map<string, number>();
	for (const point of points) {
		const combined = (counts.get(point.timestamp) ?? 0) + point.count;
		if (!Number.isSafeInteger(combined)) throw new Error('Campaign analytics total exceeds the safe integer limit.');
		counts.set(point.timestamp, combined);
	}
	return Array.from(counts, ([timestamp, bucketCount]) => ({ timestamp, count: bucketCount }))
		.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}
