import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { EditableShortlink } from '~/features/shortlinks/contracts';
import { ShortlinkForm, type ShortlinkFormValues } from '~/features/shortlinks/form';
import { decodeShortlinkRouteCode, shortlinkDetailHref } from '~/features/shortlinks/routing';
import { editShortlink, getEditableShortlink, getShortlink, getShortlinkOverview, listShortlinks } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '../shortlinks.css';

export const route = defineFileRoute('/shortlinks/:code/edit', {
	preload: ({ params }) => void getEditableShortlink(decodeShortlinkRouteCode(params.code)),
});

export default function EditShortlinkPage(props: RouteProps<typeof route>) {
	const session = createMemo(() => requireSession());
	const shortlink = createMemo(() => getEditableShortlink(decodeShortlinkRouteCode(props.params.code)));
	const canView = createMemo(() => session().permissions['shortlink']?.includes('view') ?? false);
	return <Show when={shortlink()}>{(resolved) => <EditShortlinkEditor shortlink={resolved()} canView={canView()} />}</Show>;
}

/** Do not construct form signals while the Start Mode route query is suspended. */
function EditShortlinkEditor(props: { shortlink: EditableShortlink; canView: boolean }) {
	const navigate = useNavigate();
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function handleSubmit(values: ShortlinkFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			await editShortlink({ ...values, shortCode: props.shortlink.shortCode });
			revalidate([
				getEditableShortlink.keyFor(props.shortlink.shortCode),
				getShortlink.keyFor(props.shortlink.shortCode),
				listShortlinks.key,
				getShortlinkOverview.key,
			]);
			toast.success('Shortlink updated.');
			navigate(props.canView ? shortlinkDetailHref(props.shortlink.shortCode) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The shortlink could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="shortlinks-page shortlink-editor-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb">
				<a href={props.canView ? '/shortlinks' : '/'}>{props.canView ? 'Shortlinks' : 'Dashboard'}</a>
				<span aria-hidden="true">/</span>
				<Show when={props.canView}>
					<a href={shortlinkDetailHref(props.shortlink.shortCode)}>{props.shortlink.shortCode}</a>
					<span aria-hidden="true">/</span>
				</Show>
				<span>Edit</span>
			</nav>
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
				pending={pending()}
				error={error()}
				cancelHref={props.canView ? shortlinkDetailHref(props.shortlink.shortCode) : '/'}
				onSubmit={(values) => void handleSubmit(values)}
			/>
		</section>
	);
}
