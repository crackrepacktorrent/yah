import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo, createSignal } from 'solid-js';
import { listMailingLists } from '~/features/mailing-lists/server';
import { SubscriberCreateForm, type SubscriberCreateFormValues } from '~/features/subscribers/form';
import { subscriberHref } from '~/features/subscribers/routing';
import { createSubscriber, listSubscribers, requireSubscriberCapability } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/subscribers/new', {
	preload: () => void requireSubscriberCapability('create'),
});

export default function NewSubscriberPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireSubscriberCapability('create'));
	const session = createMemo(() => requireSession());
	const canViewSubscribers = createMemo(() => session().permissions['subscriber']?.includes('view') ?? false);
	const canViewLists = createMemo(() => session().permissions['list']?.includes('view') ?? false);
	const lists = createMemo(() => canViewLists() ? listMailingLists() : []);
	const cancelHref = createMemo(() => canViewSubscribers() ? '/emails/subscribers' : '/');
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function submit(values: SubscriberCreateFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			const created = await createSubscriber(values);
			revalidate(listSubscribers.key);
			toast.success('Subscriber created.');
			navigate(canViewSubscribers() ? subscriberHref(created.id) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The subscriber could not be created.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="subscribers-page">
			{authorized()}
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href={cancelHref()}>{canViewSubscribers() ? 'Subscribers' : 'Dashboard'}</a><span aria-hidden="true">/</span><span>New</span></nav>
			<h1>New subscriber</h1>
			<p>Create the identity first; confirmation requests and blocklisting remain separate, explicit actions.</p>
			<SubscriberCreateForm lists={lists()} pending={pending()} error={error()} cancelHref={cancelHref()} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
