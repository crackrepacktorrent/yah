import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Errored, For, Loading, Show, createMemo } from 'solid-js';
import {
	aggregateCampaignAnalyticsByTimestamp,
	MAX_CAMPAIGN_ANALYTICS_IDS,
	type CampaignAnalyticsMetric,
	type CampaignAnalyticsPoint,
} from '~/features/campaign-analytics/contracts';
import {
	decodeCampaignAnalyticsLocation,
	type CampaignAnalyticsSelection,
} from '~/features/campaign-analytics/routing';
import {
	campaignAnalyticsNeedsTime,
	formatCampaignAnalyticsTimestamp,
} from '~/features/campaign-analytics/presentation';
import { getCampaignAnalytics } from '~/features/campaign-analytics/server';
import { campaignStatusLabel } from '~/features/campaigns/presentation';
import { listCampaigns } from '~/features/campaigns/server';
import type { CampaignSummary } from '~/features/campaigns/contracts';
import { PageHeader } from '~/ui/page-header';
import { visibleError } from '~/ui/visible-error';
import './index.css';

export const route = defineFileRoute('/emails/analytics', {
	preload: () => void listCampaigns(),
});

const metricLabels: Record<CampaignAnalyticsMetric, { title: string; noun: string; empty: string }> = {
	views: { title: 'Email views', noun: 'view', empty: 'No email views were recorded in this period.' },
	clicks: { title: 'Link clicks', noun: 'click', empty: 'No link clicks were recorded in this period.' },
};

export default function CampaignAnalyticsPage() {
	const [searchParams] = useSearchParams();
	const location = createMemo(() => decodeCampaignAnalyticsLocation(searchParams));
	const campaigns = createMemo(() => listCampaigns());

	return (
		<Show when={campaigns()}>
			{(catalog) => <CampaignAnalyticsView campaigns={catalog()} location={location()} />}
		</Show>
	);
}

function CampaignAnalyticsView(props: {
	campaigns: CampaignSummary[];
	location: ReturnType<typeof decodeCampaignAnalyticsLocation>;
}) {
	const navigate = useNavigate();
	const selectedIds = createMemo(() => new Set(props.location.campaignIds));
	const selectedCampaigns = createMemo(() => props.campaigns.filter(({ id }) => selectedIds().has(id)));
	const missingCampaigns = createMemo(() => props.location.campaignIds.length - selectedCampaigns().length);
	const selection = createMemo<CampaignAnalyticsSelection | null>(() => {
		if (props.location.error || props.location.campaignIds.length === 0 || missingCampaigns() > 0) return null;
		return {
			campaignIds: props.location.campaignIds,
			from: props.location.from,
			to: props.location.to,
		};
	});

	function applyFilters(event: SubmitEvent): void {
		event.preventDefault();
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) return;
		const query = new URLSearchParams();
		for (const [name, value] of new FormData(form)) {
			if (typeof value === 'string') query.append(name, value);
		}
		navigate(`/emails/analytics?${query.toString()}`);
	}

	return (
		<section class="campaign-analytics-page">
			<PageHeader eyebrow="Email delivery" title="Campaign analytics" />
			<p class="campaign-analytics-intro">
				Compare provider-recorded email views and link clicks. Dates are UTC, and each metric uses one bounded Listmonk request regardless of how many campaigns you select.
			</p>

			<form class="campaign-analytics-filters" action="/emails/analytics" method="get" onSubmit={applyFilters}>
				<fieldset>
					<legend>Campaigns</legend>
					<p>Select up to {MAX_CAMPAIGN_ANALYTICS_IDS} campaigns. Campaigns stay in provider order.</p>
					<Show when={props.campaigns.length > 0} fallback={<p>No campaigns are available.</p>}>
						<div class="campaign-analytics-options">
							<For each={props.campaigns}>
								{(campaign) => (
									<label>
										<input type="checkbox" name="campaign" value={campaign.id} checked={selectedIds().has(campaign.id)} />
										<span>{campaign.name}</span>
										<small>{campaignStatusLabel(campaign.status)} · {campaign.subject}</small>
									</label>
								)}
							</For>
						</div>
					</Show>
				</fieldset>
				<div class="campaign-analytics-dates">
					<label><span>From</span><input type="date" name="from" required value={props.location.from} /></label>
					<label><span>To</span><input type="date" name="to" required value={props.location.to} /></label>
				</div>
				<div class="campaign-analytics-actions">
					<button class="button" type="submit" disabled={props.campaigns.length === 0}>Apply</button>
					<Show when={props.location.campaignIds.length > 0 || props.location.error}>
						<a class="button button--secondary" href="/emails/analytics">Clear</a>
					</Show>
				</div>
			</form>

			<Show when={props.location.error}>
				<p class="campaign-analytics-filter-error" role="alert">{props.location.error}</p>
			</Show>
			<Show when={!props.location.error && missingCampaigns() > 0}>
				<p class="campaign-analytics-filter-error" role="alert">One or more selected campaigns are no longer available. Clear them and try again.</p>
			</Show>
			<Show when={!props.location.error && props.location.campaignIds.length === 0}>
				<p class="campaign-analytics-empty">Select at least one campaign to view email analytics.</p>
			</Show>

			<Show when={selection()}>
				{(query) => (
					<div class="campaign-analytics-results">
						<p class="visually-hidden" role="status" aria-live="polite">
							Showing analytics for {selectedCampaigns().length} campaign{selectedCampaigns().length === 1 ? '' : 's'} from {query().from} through {query().to}.
						</p>
						<CampaignMetricPanel metric="views" selection={query()} />
						<CampaignMetricPanel metric="clicks" selection={query()} />
					</div>
				)}
			</Show>
		</section>
	);
}

function CampaignMetricPanel(props: { metric: CampaignAnalyticsMetric; selection: CampaignAnalyticsSelection }) {
	const query = createMemo(() => ({ ...props.selection, metric: props.metric }));
	const points = createMemo(() => getCampaignAnalytics(query()));
	const labels = createMemo(() => metricLabels[props.metric]);

	function retry(reset: () => void): void {
		void revalidate(getCampaignAnalytics.keyFor(query()), true);
		reset();
	}

	return (
		<section class="campaign-metric-panel" aria-labelledby={`campaign-${props.metric}-heading`}>
			<h2 id={`campaign-${props.metric}-heading`}>{labels().title}</h2>
			<Errored
				fallback={(error, reset) => (
					<div class="campaign-metric-error" role="alert">
						<p>{visibleError(error(), `Campaign ${labels().noun} analytics could not be loaded.`)}</p>
						<button class="button button--secondary" type="button" onClick={() => retry(reset)}>Try again</button>
					</div>
				)}
			>
				<Loading on={query()} fallback={<p class="campaign-metric-loading" role="status">Loading {labels().title.toLowerCase()}…</p>}>
					<Show when={points()}>{(resolved) => <CampaignMetricFigure metric={props.metric} points={resolved()} />}</Show>
				</Loading>
			</Errored>
		</section>
	);
}

function CampaignMetricFigure(props: { metric: CampaignAnalyticsMetric; points: CampaignAnalyticsPoint[] }) {
	const buckets = createMemo(() => aggregateCampaignAnalyticsByTimestamp(props.points));
	const includeTime = createMemo(() => campaignAnalyticsNeedsTime(buckets()));
	const maximum = createMemo(() => Math.max(1, ...buckets().map(({ count }) => count)));
	const total = createMemo(() => buckets().reduce((sum, { count }) => {
		const next = sum + count;
		if (!Number.isSafeInteger(next)) throw new Error('Campaign analytics total exceeds the safe integer limit.');
		return next;
	}, 0));
	const labels = createMemo(() => metricLabels[props.metric]);

	return (
		<Show when={buckets().length > 0} fallback={<p class="campaign-metric-empty">{labels().empty}</p>}>
			<figure class="campaign-metric-figure">
				<figcaption>{total().toLocaleString()} total {labels().noun}{total() === 1 ? '' : 's'}</figcaption>
				<ul>
					<For each={buckets()}>
						{(bucket) => (
							<li>
								<time datetime={bucket.timestamp}>{formatCampaignAnalyticsTimestamp(bucket.timestamp, includeTime())}</time>
								<strong>{bucket.count.toLocaleString()}</strong>
								<span class="campaign-metric-track" aria-hidden="true">
									<span style={{ width: `${(bucket.count / maximum()) * 100}%` }} />
								</span>
							</li>
						)}
					</For>
				</ul>
			</figure>
		</Show>
	);
}
