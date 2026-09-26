import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { ShortlinkForm } from '~/features/shortlinks/form';
import { shortlinkDetailHref } from '~/features/shortlinks/routing';
import { createShortlink, getShortlinkOverview, listShortlinks, requireShortlinkCapability } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { toast } from '~/ui/toast';
import { createCommandTask } from '~/ui/command-task';
import { createPublicError } from '~/platform/errors';
import './shortlinks.css';

export const route = defineFileRoute('/shortlinks/new', {
	preload: () => void requireShortlinkCapability('create'),
});

export default function NewShortlinkPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireShortlinkCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => can(session(), 'shortlink', 'view'));
	const task = createCommandTask();

	async function handleSubmit(command: Parameters<typeof createShortlink>[0]): Promise<void> {
		const showDetail = canView();
		await task.run(async () => {
			const result = await createShortlink(command);
			if (!result.ok) {
				throw createPublicError(result.message, 409);
			}
			revalidate([listShortlinks.key, getShortlinkOverview.key]);
			toast.success(`Shortlink ${result.shortCode} created.`);
			navigate(showDetail ? shortlinkDetailHref(result.shortCode) : '/');
		}, 'The shortlink could not be created.');
	}

	return (
		<section class="shortlinks-page shortlink-editor-page">
			{authorized()}
			<Breadcrumbs items={[{ href: canView() ? '/shortlinks' : '/', label: canView() ? 'Shortlinks' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New shortlink</h1>
			<p>Create a tracked redirect with an automatic or custom short code.</p>
			<ShortlinkForm
				mode="create"
				pending={task.pending()}
				error={task.error()}
				cancelHref={canView() ? '/shortlinks' : '/'}
				onSubmit={(values) => void handleSubmit(values)}
			/>
		</section>
	);
}
