import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import type { EditableShortlink } from '~/features/shortlinks/contracts';
import { ShortlinkForm, type ShortlinkFormValues } from '~/features/shortlinks/form';
import { decodeShortlinkRouteCode, shortlinkDetailHref } from '~/features/shortlinks/routing';
import { editShortlink, getEditableShortlink, getShortlink, getShortlinkOverview, listShortlinks } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import '../shortlinks.css';

export const route = defineFileRoute('/shortlinks/:code/edit', {
	matchFilters: { code: (segment) => decodeShortlinkRouteCode(segment) !== '' },
	preload: ({ params }) => void getEditableShortlink(decodeShortlinkRouteCode(params.code)),
});

export default function EditShortlinkPage(props: RouteProps<typeof route>) {
	const shortCode = createMemo(() => decodeShortlinkRouteCode(props.params.code));
	return <Show when={shortCode()} keyed>{(resolved) => <EditShortlinkRoute shortCode={resolved} />}</Show>;
}

function EditShortlinkRoute(props: { shortCode: string }) {
	const session = createMemo(() => requireSession());
	const shortlink = createMemo(() => getEditableShortlink(props.shortCode));
	const canView = createMemo(() => can(session(), 'shortlink', 'view'));
	return <Show when={shortlink()}>{(resolved) => <EditShortlinkEditor shortlink={resolved()} canView={canView()} />}</Show>;
}

/** Do not construct form signals while the Start Mode route query is suspended. */
function EditShortlinkEditor(props: { shortlink: EditableShortlink; canView: boolean }) {
	const navigate = useNavigate();
	const updateTask = createCommandTask();

	async function handleSubmit(values: ShortlinkFormValues): Promise<void> {
		const shortCode = props.shortlink.shortCode;
		const destination = props.canView ? shortlinkDetailHref(shortCode) : '/';
		await updateTask.run(async () => {
			await editShortlink({ ...values, shortCode });
			revalidate([
				getEditableShortlink.keyFor(shortCode),
				getShortlink.keyFor(shortCode),
				listShortlinks.key,
				getShortlinkOverview.key,
			]);
			toast.success('Shortlink updated.');
			navigate(destination);
		}, 'The shortlink could not be updated.');
	}

	return (
		<section class="shortlinks-page shortlink-editor-page">
			<Breadcrumbs items={[
				{ href: props.canView ? '/shortlinks' : '/', label: props.canView ? 'Shortlinks' : 'Dashboard' },
				...(props.canView ? [{ href: shortlinkDetailHref(props.shortlink.shortCode), label: props.shortlink.shortCode }] : []),
				{ label: 'Edit' },
			]} />
			<h1>Edit {props.shortlink.shortCode}</h1>
			<p>The short code is permanent; create a new link if it needs to change.</p>
			<ShortlinkForm
				mode="edit"
				initial={{
					longUrl: props.shortlink.longUrl,
					title: props.shortlink.title ?? '',
					tags: props.shortlink.tags,
					maxVisits: props.shortlink.maxVisits,
					...(props.shortlink.validUntil ? { validUntil: props.shortlink.validUntil } : {}),
					crawlable: props.shortlink.crawlable,
					forwardQuery: props.shortlink.forwardQuery,
				}}
				pending={updateTask.pending()}
				error={updateTask.error()}
				cancelHref={props.canView ? shortlinkDetailHref(props.shortlink.shortCode) : '/'}
				onSubmit={(values) => void handleSubmit(values)}
			/>
		</section>
	);
}
