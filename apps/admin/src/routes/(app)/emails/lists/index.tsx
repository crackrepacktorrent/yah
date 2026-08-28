import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo } from 'solid-js';
import { mailingListKindLabel, mailingListStatusLabel } from '~/features/mailing-lists/form';
import { mailingListHref } from '~/features/mailing-lists/routing';
import { listMailingLists } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/emails/lists', {
	preload: () => void listMailingLists(),
});

export default function MailingListsPage() {
	const lists = createMemo(() => listMailingLists());
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => can(session(), 'list', 'create'));

	return (
		<section class="mailing-lists-page">
			<PageHeader eyebrow="Email audiences" title="Mailing lists">
				<Show when={canCreate()}><a class="button" href="/emails/lists/new">New list</a></Show>
			</PageHeader>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Mailing lists</caption>
					<thead><tr><th scope="col">Name</th><th scope="col">Visibility</th><th scope="col">Status</th><th scope="col">Opt-in</th><th scope="col">Subscribers</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={lists().length > 0} fallback={<tr><td colspan="6">No mailing lists yet.</td></tr>}>
							<For each={lists()}>{(list) => (
								<tr>
									<td><a class="mailing-list-name" href={mailingListHref(list.id)}>{list.name}</a></td>
									<td><span class="badge">{mailingListKindLabel(list.kind)}</span></td>
									<td><span class="badge">{mailingListStatusLabel(list.status)}</span></td>
									<td>{list.optIn === 'double' ? 'Double' : 'Single'}</td>
									<td>{list.subscriberCount}<Show when={list.unconfirmedCount > 0}><small class="mailing-list-unconfirmed">{list.unconfirmedCount} unconfirmed</small></Show></td>
									<td>{new Date(list.updatedAt).toLocaleDateString()}</td>
								</tr>
							)}</For>
						</Show>
					</tbody>
				</table>
			</div>
		</section>
	);
}
