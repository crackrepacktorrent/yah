import { For, Show, createMemo } from 'solid-js';
import type { SubscriberActivity } from './contracts';
import { safeActivityLinkHref } from './presentation';
import { getSubscriberActivity } from './server';

export function SubscriberActivityView(props: { subscriberId: number }) {
	const activity = createMemo(() => getSubscriberActivity(props.subscriberId));
	return <Show when={activity()}>{(resolved) => <ActivityResults activity={resolved()} />}</Show>;
}

function ActivityResults(props: { activity: SubscriberActivity }) {
	return (
		<div class="subscriber-activity-results">
			<section><h3>Campaign views</h3><Show when={props.activity.campaignViews.length > 0} fallback={<p>No campaign views.</p>}><ul><For each={props.activity.campaignViews}>{(view) => <li><strong>{view.campaignName || `Campaign ${view.campaignId}`}</strong><span>{view.viewCount.toLocaleString()} view{view.viewCount === 1 ? '' : 's'} · last {new Date(view.lastViewedAt).toLocaleString()}</span></li>}</For></ul></Show></section>
			<section><h3>Link clicks</h3><Show when={props.activity.linkClicks.length > 0} fallback={<p>No link clicks.</p>}><ul><For each={props.activity.linkClicks}>{(click) => <li><Show when={safeActivityLinkHref(click.url)} fallback={<span>{click.url}</span>}>{(href) => <a href={href()} target="_blank" rel="noreferrer">{click.url}</a>}</Show><span>{click.clickCount.toLocaleString()} click{click.clickCount === 1 ? '' : 's'} · last {new Date(click.lastClickedAt).toLocaleString()}{click.campaignName ? ` · ${click.campaignName}` : ''}</span></li>}</For></ul></Show></section>
		</div>
	);
}
