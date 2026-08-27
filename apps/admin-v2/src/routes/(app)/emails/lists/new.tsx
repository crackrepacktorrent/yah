import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo, createSignal } from 'solid-js';
import { MailingListForm, type MailingListFormValues } from '~/features/mailing-lists/form';
import { mailingListHref } from '~/features/mailing-lists/routing';
import { createMailingList, listMailingLists, requireMailingListCapability } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/lists/new', {
	preload: () => void requireMailingListCapability('create'),
});

export default function NewMailingListPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireMailingListCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => session().permissions['list']?.includes('view') ?? false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function submit(values: MailingListFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			const created = await createMailingList({ name: values.name, kind: values.kind, optIn: values.optIn, description: values.description });
			revalidate(listMailingLists.key);
			toast.success('Mailing list created.');
			navigate(canView() ? mailingListHref(created.id) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The mailing list could not be created.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="mailing-lists-page">
			{authorized()}
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href={canView() ? '/emails/lists' : '/'}>{canView() ? 'Mailing lists' : 'Dashboard'}</a><span aria-hidden="true">/</span><span>New</span></nav>
			<h1>New mailing list</h1>
			<p>Start private with double opt-in unless this audience is ready for public subscriptions.</p>
			<MailingListForm mode="create" pending={pending()} error={error()} cancelHref={canView() ? '/emails/lists' : '/'} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
