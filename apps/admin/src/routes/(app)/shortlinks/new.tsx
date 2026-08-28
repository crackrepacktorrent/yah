import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo, createSignal } from 'solid-js';
import { ShortlinkForm } from '~/features/shortlinks/form';
import { shortlinkDetailHref } from '~/features/shortlinks/routing';
import { createShortlink, getShortlinkOverview, listShortlinks, requireShortlinkCapability } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import './shortlinks.css';

export const route = defineFileRoute('/shortlinks/new', {
	preload: () => void requireShortlinkCapability('create'),
});

export default function NewShortlinkPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireShortlinkCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => can(session(), 'shortlink', 'view'));
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function handleSubmit(command: Parameters<typeof createShortlink>[0]): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await createShortlink(command);
			if (!result.ok) {
				setError(result.message);
				return;
			}
			revalidate([listShortlinks.key, getShortlinkOverview.key]);
			toast.success(`Shortlink ${result.shortCode} created.`);
			navigate(canView() ? shortlinkDetailHref(result.shortCode) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The shortlink could not be created.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="shortlinks-page shortlink-editor-page">
			{authorized()}
			<Breadcrumbs items={[{ href: canView() ? '/shortlinks' : '/', label: canView() ? 'Shortlinks' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New shortlink</h1>
			<p>Create a tracked redirect with an automatic or custom short code.</p>
			<ShortlinkForm
				mode="create"
				pending={pending()}
				error={error()}
				cancelHref={canView() ? '/shortlinks' : '/'}
				onSubmit={(values) => void handleSubmit(values)}
			/>
		</section>
	);
}
