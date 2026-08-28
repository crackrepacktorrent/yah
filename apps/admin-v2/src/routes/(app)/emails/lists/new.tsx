import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { MailingListForm, type MailingListFormValues } from '~/features/mailing-lists/form';
import { mailingListHref } from '~/features/mailing-lists/routing';
import { createMailingList, listMailingLists, requireMailingListCapability } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/lists/new', {
	preload: () => void requireMailingListCapability('create'),
});

export default function NewMailingListPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireMailingListCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => can(session(), 'list', 'view'));
	const createTask = createCommandTask();

	async function submit(values: MailingListFormValues): Promise<void> {
		const canNavigateToList = canView();
		await createTask.run(async () => {
			const created = await createMailingList({ name: values.name, kind: values.kind, optIn: values.optIn, description: values.description });
			revalidate(listMailingLists.key);
			toast.success('Mailing list created.');
			navigate(canNavigateToList ? mailingListHref(created.id) : '/');
		}, 'The mailing list could not be created.');
	}

	return (
		<section class="mailing-lists-page">
			{authorized()}
			<Breadcrumbs items={[{ href: canView() ? '/emails/lists' : '/', label: canView() ? 'Mailing lists' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New mailing list</h1>
			<p>Start private with double opt-in unless this audience is ready for public subscriptions.</p>
			<MailingListForm mode="create" pending={createTask.pending()} error={createTask.error()} cancelHref={canView() ? '/emails/lists' : '/'} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
