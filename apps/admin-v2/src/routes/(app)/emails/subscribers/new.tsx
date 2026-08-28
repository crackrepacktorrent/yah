import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { listMailingLists } from '~/features/mailing-lists/server';
import { SubscriberCreateForm, type SubscriberCreateFormValues } from '~/features/subscribers/form';
import { subscriberHref } from '~/features/subscribers/routing';
import { createSubscriber, listSubscribers, requireSubscriberCapability } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/subscribers/new', {
	preload: () => void requireSubscriberCapability('create'),
});

export default function NewSubscriberPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireSubscriberCapability('create'));
	const session = createMemo(() => requireSession());
	const canViewSubscribers = createMemo(() => can(session(), 'subscriber', 'view'));
	const canViewLists = createMemo(() => can(session(), 'list', 'view'));
	const lists = createMemo(() => canViewLists() ? listMailingLists() : []);
	const cancelHref = createMemo(() => canViewSubscribers() ? '/emails/subscribers' : '/');
	const createTask = createCommandTask();

	async function submit(values: SubscriberCreateFormValues): Promise<void> {
		const canNavigateToSubscriber = canViewSubscribers();
		await createTask.run(async () => {
			const created = await createSubscriber(values);
			revalidate(listSubscribers.key);
			toast.success('Subscriber created.');
			navigate(canNavigateToSubscriber ? subscriberHref(created.id) : '/');
		}, 'The subscriber could not be created.');
	}

	return (
		<section class="subscribers-page">
			{authorized()}
			<Breadcrumbs items={[{ href: cancelHref(), label: canViewSubscribers() ? 'Subscribers' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New subscriber</h1>
			<p>Create the identity first; confirmation requests and blocklisting remain separate, explicit actions.</p>
			<SubscriberCreateForm lists={lists()} pending={createTask.pending()} error={createTask.error()} cancelHref={cancelHref()} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
