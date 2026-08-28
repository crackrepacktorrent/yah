import { createAsync } from '@solidjs/router';
import { Show, createMemo } from 'solid-js';
import { createSolidTable, getCoreRowModel, createColumnHelper } from '@tanstack/solid-table';
import { PageHeader, StatCard, Section, DataTable, EmptyState } from '~/components';
import { can } from '~/lib/can';
import { formatDuration } from '~/lib/utils';
import { requireSession } from '~/routes/session';
import { getDashboard, getSiteStats } from './dashboard.server';
import type { ShortUrl } from '~/server/shlink';
import './index.css';

const columnHelper = createColumnHelper<ShortUrl>();

const recentColumns = [
	columnHelper.accessor('shortCode', {
		header: 'Short URL',
		cell: (info) => (
			<span>
				<a href={`/shortlinks/${info.getValue()}`} class="code">
					{info.getValue()}
				</a>
				<Show when={info.row.original.title}>
					<>
						<br />
						<span class="row-title">{info.row.original.title}</span>
					</>
				</Show>
			</span>
		),
	}),
	columnHelper.accessor('longUrl', {
		header: 'Destination',
		cell: (info) => (
			<span class="long-url" title={info.getValue()}>
				{info.getValue()}
			</span>
		),
	}),
	columnHelper.accessor((row) => row.visitsSummary.total, {
		id: 'clicks',
		header: 'Clicks',
		cell: (info) => <span class="clicks">{info.getValue()}</span>,
	}),
	columnHelper.accessor('dateCreated', {
		header: 'Created',
		cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
	}),
];

export default function DashboardPage() {
	const session = createAsync(() => requireSession());
	const canViewShortlinks = createMemo(() => can(session(), 'shortlink', 'view'));
	const canViewAnalytics = createMemo(() => can(session(), 'analytics', 'view'));
	const dashboard = createAsync(() => (canViewShortlinks() ? getDashboard() : Promise.resolve(null)));
	const siteStats = createAsync(() => (canViewAnalytics() ? getSiteStats() : Promise.resolve(null)));

	const recentTable = createSolidTable({
		get data() {
			return dashboard()?.recentShortUrls ?? [];
		},
		columns: recentColumns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnFilters: false,
		enableSorting: false,
	});

	return (
		<>
			<PageHeader title="Dashboard" />
			<Show when={!canViewShortlinks() && !canViewAnalytics()}>
				<EmptyState message="No dashboard data is available for your role." />
			</Show>

			<Show when={dashboard()}>
				{(data) => (
					<>
						<div class="stats-grid" style={{ 'margin-bottom': '2rem' }}>
							<StatCard value={data().totalShortUrls} label="Short URLs" accent="var(--brand-orange)" />
							<StatCard value={data().visits.nonOrphanVisits.total.toLocaleString()} label="Total Clicks" accent="var(--brand-amber)" />
							<StatCard value={data().visits.nonOrphanVisits.nonBots.toLocaleString()} label="Human Clicks" accent="var(--brand-olive)" />
							<StatCard value={data().visits.nonOrphanVisits.bots.toLocaleString()} label="Bot Clicks" accent="var(--brand-magenta)" />
						</div>

						<section class="dashboard-section">
							<h2>Recent Shortlinks</h2>
							<DataTable table={recentTable} emptyMessage="No shortlinks yet." />
						</section>
					</>
				)}
			</Show>

			<Show when={siteStats()}>
				{(stats) => (
					<section class="dashboard-section">
						<h2>Site Analytics</h2>
						<div class="analytics-periods">
							<Section title="Last 24 Hours">
								<div class="stats-grid">
									<StatCard value={stats().today.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
									<StatCard value={stats().today.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
									<StatCard value={`${stats().today.bounceRate}%`} label="Bounce Rate" accent="var(--brand-magenta)" />
									<StatCard value={formatDuration(stats().today.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
								</div>
							</Section>

							<Section title="Last 30 Days">
								<div class="stats-grid">
									<StatCard value={stats().month.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
									<StatCard value={stats().month.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
									<StatCard value={`${stats().month.bounceRate}%`} label="Bounce Rate" accent="var(--brand-magenta)" />
									<StatCard value={formatDuration(stats().month.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
								</div>
							</Section>
						</div>
					</section>
				)}
			</Show>
		</>
	);
}
