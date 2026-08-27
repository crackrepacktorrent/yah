import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo } from 'solid-js';
import { shortlinkDetailHref } from '~/features/shortlinks/routing';
import { listShortlinks } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import './shortlinks.css';

export const route = defineFileRoute('/shortlinks', {
	preload: () => void listShortlinks(),
});

export default function ShortlinkListPage() {
	const links = createMemo(() => listShortlinks());
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => session().permissions['shortlink']?.includes('create') ?? false);

	return (
		<section class="shortlinks-page">
			<header class="page-header">
				<div>
					<p class="eyebrow">Redirects</p>
					<h1>Shortlinks</h1>
				</div>
				<Show when={canCreate()}><a class="button" href="/shortlinks/new">New shortlink</a></Show>
			</header>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Shortlinks</caption>
					<thead><tr><th scope="col">Short URL</th><th scope="col">Destination</th><th scope="col">Tags</th><th scope="col">Clicks</th><th scope="col">Created</th></tr></thead>
					<tbody>
						<Show when={links().length > 0} fallback={<tr><td colspan="5">No shortlinks yet.</td></tr>}>
							<For each={links()}>{(link) => (
								<tr>
									<td><span><a class="short-code" href={shortlinkDetailHref(link.shortCode)}>{link.shortCode}</a><Show when={link.title}>{(title) => <small class="row-title">{title()}</small>}</Show></span></td>
									<td><span class="destination" title={link.longUrl}>{link.longUrl}</span></td>
									<td><span class="tag-list"><For each={link.tags}>{(tag) => <span>{tag}</span>}</For></span></td>
									<td>{link.visits.total}</td>
									<td>{new Date(link.dateCreated).toLocaleDateString()}</td>
								</tr>
							)}</For>
						</Show>
					</tbody>
				</table>
			</div>
		</section>
	);
}
