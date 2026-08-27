import { revalidate } from '@solidjs/router';
import { Errored, For, Loading, Show, createMemo } from 'solid-js';
import { getSiteOverview } from '~/features/analytics/server';
import { shortlinkDetailHref } from '~/features/shortlinks/routing';
import { getShortlinkOverview } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import './index.css';

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function PanelError(props: { title: string; retry: () => void }) {
	return (
		<section class="dashboard-panel dashboard-panel--error" role="alert">
			<h2>{props.title}</h2>
			<p>This dashboard section could not be loaded. The other sections remain available.</p>
			<button class="dashboard-retry" type="button" onClick={() => props.retry()}>Try again</button>
		</section>
	);
}

export default function DashboardPage() {
	const session = createMemo(() => requireSession());
	const canViewShortlinks = createMemo(() => session().permissions['shortlink']?.includes('view') ?? false);
	const canViewAnalytics = createMemo(() => session().permissions['analytics']?.includes('view') ?? false);
	const shortlinks = createMemo(() => (canViewShortlinks() ? getShortlinkOverview() : null));
	const site = createMemo(() => (canViewAnalytics() ? getSiteOverview() : null));

	return (
		<section class="dashboard-page">
			<header class="dashboard-header">
				<p class="eyebrow">Overview</p>
				<h1>Dashboard</h1>
			</header>

			<Show when={!canViewShortlinks() && !canViewAnalytics()}>
				<p class="dashboard-empty">No dashboard data is available for your role.</p>
			</Show>

			<Show when={canViewShortlinks()}>
				<Errored
					fallback={(_error, reset) => (
						<PanelError title="Shortlinks unavailable" retry={() => { revalidate(getShortlinkOverview.key, true); reset(); }} />
					)}
				>
					<Loading fallback={<p class="dashboard-status" role="status">Loading shortlink overview…</p>}>
						<Show when={shortlinks()}>
							{(data) => (
								<>
									<dl class="dashboard-stats">
										<div><dt>Short URLs</dt><dd>{data().totalShortlinks.toLocaleString()}</dd></div>
										<div><dt>Total clicks</dt><dd>{data().visits.total.toLocaleString()}</dd></div>
										<div><dt>Human clicks</dt><dd>{data().visits.nonBots.toLocaleString()}</dd></div>
										<div><dt>Bot clicks</dt><dd>{data().visits.bots.toLocaleString()}</dd></div>
									</dl>
									<section class="dashboard-panel" aria-labelledby="recent-shortlinks-heading">
										<h2 id="recent-shortlinks-heading">Recent shortlinks</h2>
										<div class="dashboard-table-scroll">
											<table>
												<caption class="visually-hidden">Five most recently created shortlinks</caption>
												<thead><tr><th scope="col">Short URL</th><th scope="col">Destination</th><th scope="col">Clicks</th><th scope="col">Created</th></tr></thead>
												<tbody>
													<Show when={data().recentShortlinks.length > 0} fallback={<tr><td colspan="4">No shortlinks yet.</td></tr>}>
														<For each={data().recentShortlinks}>
															{(link) => (
																<tr>
																	<td><a href={shortlinkDetailHref(link.shortCode)}>{link.shortCode}</a><Show when={link.title}>{(title) => <small>{title()}</small>}</Show></td>
																	<td class="dashboard-destination" title={link.longUrl}>{link.longUrl}</td>
																	<td>{link.visits.total.toLocaleString()}</td>
																	<td>{new Date(link.dateCreated).toLocaleDateString()}</td>
																</tr>
															)}
														</For>
													</Show>
												</tbody>
											</table>
										</div>
									</section>
								</>
							)}
						</Show>
					</Loading>
				</Errored>
			</Show>

			<Show when={canViewAnalytics()}>
				<Errored
					fallback={(_error, reset) => (
						<PanelError title="Site analytics unavailable" retry={() => { revalidate(getSiteOverview.key, true); reset(); }} />
					)}
				>
					<Loading fallback={<p class="dashboard-status" role="status">Loading site overview…</p>}>
						<Show when={site()}>
							{(data) => (
								<section class="dashboard-panel" aria-labelledby="site-overview-heading">
									<h2 id="site-overview-heading">Site analytics</h2>
									<div class="site-periods">
										<For each={[['Last 24 hours', data().today], ['Last 30 days', data().month]] as const}>
											{([label, period]) => (
												<section>
													<h3>{label}</h3>
													<dl class="dashboard-stats">
														<div><dt>Pageviews</dt><dd>{period.pageviews.toLocaleString()}</dd></div>
														<div><dt>Visitors</dt><dd>{period.visitors.toLocaleString()}</dd></div>
														<div><dt>Bounce rate</dt><dd>{period.bounceRate}%</dd></div>
														<div><dt>Average visit</dt><dd>{formatDuration(period.averageVisitSeconds)}</dd></div>
													</dl>
												</section>
											)}
										</For>
									</div>
								</section>
							)}
						</Show>
					</Loading>
				</Errored>
			</Show>
		</section>
	);
}
