export const ANALYTICS_PERIODS = ['24h', '7d', '30d'] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type AnalyticsMetric = {
	label: string;
	visitors: number;
};

export type AnalyticsPoint = {
	timestamp: string;
	pageviews: number;
};

export type AnalyticsCity = AnalyticsMetric & {
	region: string;
	coordinates: [longitude: number, latitude: number] | null;
};

export type AnalyticsSnapshot = {
	period: AnalyticsPeriod;
	range: { startAt: number; endAt: number };
	stats: {
		pageviews: number;
		visitors: number;
		visits: number;
		bounceRate: number;
		averageVisitSeconds: number;
	};
	activeVisitors: number;
	pageviews: AnalyticsPoint[];
	pages: AnalyticsMetric[];
	referrers: AnalyticsMetric[];
	browsers: AnalyticsMetric[];
	operatingSystems: AnalyticsMetric[];
	devices: AnalyticsMetric[];
	cities: AnalyticsCity[];
	countries: AnalyticsMetric[];
};

export type SiteOverviewPeriod = {
	pageviews: number;
	visitors: number;
	bounceRate: number;
	averageVisitSeconds: number;
};

export type SiteOverview = {
	today: SiteOverviewPeriod;
	month: SiteOverviewPeriod;
};
