import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { isPrintedQrShortCode } from '@yah/admin-core/shortlink-policy';
import { decodeShortlinkRouteCode, shortlinkEditHref } from '~/features/shortlinks/routing';
import { deleteShortlink, getShortlink, getShortlinkOverview, listShortlinks, resetShortlinkVisits } from '~/features/shortlinks/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { QrCode } from '~/ui/qr-code';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '../shortlinks.css';

export const route = defineFileRoute('/shortlinks/:code/details', {
	matchFilters: { code: (segment) => decodeShortlinkRouteCode(segment) !== '' },
	preload: ({ params }) => void getShortlink(decodeShortlinkRouteCode(params.code)),
});

export default function ShortlinkDetailPage(props: RouteProps<typeof route>) {
	const shortCode = createMemo(() => decodeShortlinkRouteCode(props.params.code));
	return <Show when={shortCode()} keyed>{(resolved) => <ShortlinkDetailRoute shortCode={resolved} />}</Show>;
}

function ShortlinkDetailRoute(props: { shortCode: string }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const detail = createMemo(() => getShortlink(props.shortCode));
	const canEdit = createMemo(() => session().permissions['shortlink']?.includes('edit') ?? false);
	const canDelete = createMemo(() => session().permissions['shortlink']?.includes('delete') ?? false);
	const printedQr = createMemo(() => isPrintedQrShortCode(detail().shortlink.shortCode));
	const [dialog, setDialog] = createSignal<'reset' | 'delete' | null>(null);
	const [pending, setPending] = createSignal(false);
	const [dialogError, setDialogError] = createSignal('');

	async function resetVisits(): Promise<void> {
		setDialogError('');
		setPending(true);
		try {
			const result = await resetShortlinkVisits(detail().shortlink.shortCode);
			revalidate([getShortlink.keyFor(detail().shortlink.shortCode), getShortlinkOverview.key]);
			setDialog(null);
			toast.success(`Deleted ${result.deletedCount} visit${result.deletedCount === 1 ? '' : 's'}.`);
		} catch (error) {
			setDialogError(visibleError(error, 'Visit history could not be reset.'));
		} finally {
			setPending(false);
		}
	}

	async function removeShortlink(): Promise<void> {
		setDialogError('');
		setPending(true);
		try {
			await deleteShortlink(detail().shortlink.shortCode);
			revalidate([listShortlinks.key, getShortlinkOverview.key]);
			setDialog(null);
			toast.success('Shortlink deleted.');
			navigate('/shortlinks');
		} catch (error) {
			setDialogError(visibleError(error, 'The shortlink could not be deleted.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="shortlinks-page shortlink-detail-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb">
				<a href="/shortlinks">Shortlinks</a><span aria-hidden="true">/</span><span>{detail().shortlink.shortCode}</span>
			</nav>
			<header class="page-header">
				<div>
					<p class="eyebrow">Tracked redirect</p>
					<h1>{detail().shortlink.title || detail().shortlink.shortCode}</h1>
				</div>
				<div class="detail-actions">
					<Show when={canEdit()}>
						<a class="button button--secondary" href={shortlinkEditHref(detail().shortlink.shortCode)}>Edit</a>
						<button type="button" class="button button--danger-secondary" onClick={() => { setDialogError(''); setDialog('reset'); }}>
							Reset visits
						</button>
					</Show>
					<Show when={canDelete() && !printedQr()}>
						<button type="button" class="button button--danger" onClick={() => { setDialogError(''); setDialog('delete'); }}>Delete</button>
					</Show>
				</div>
			</header>
			<Show when={printedQr()}>
				<p class="table-note">This permanent short URL is printed in QR materials. Its destination can be updated, but the shortlink cannot be deleted.</p>
			</Show>

			<dl class="shortlink-stats">
				<div><dt>Total clicks</dt><dd>{detail().shortlink.visits.total.toLocaleString()}</dd></div>
				<div><dt>Human</dt><dd>{detail().shortlink.visits.nonBots.toLocaleString()}</dd></div>
				<div><dt>Bots</dt><dd>{detail().shortlink.visits.bots.toLocaleString()}</dd></div>
			</dl>

			<div class="detail-grid">
				<section class="detail-card" aria-labelledby="shortlink-details-heading">
					<h2 id="shortlink-details-heading">Details</h2>
					<dl class="detail-list">
						<div><dt>Short URL</dt><dd><a href={detail().shortlink.shortUrl} target="_blank" rel="noopener noreferrer">{detail().shortlink.shortUrl}</a></dd></div>
						<div><dt>Destination</dt><dd><a href={detail().shortlink.longUrl} target="_blank" rel="noopener noreferrer">{detail().shortlink.longUrl}</a></dd></div>
						<div><dt>Created</dt><dd>{new Date(detail().shortlink.dateCreated).toLocaleString()}</dd></div>
						<div><dt>Query forwarding</dt><dd>{detail().shortlink.forwardQuery ? 'Enabled' : 'Disabled'}</dd></div>
						<div><dt>Search crawling</dt><dd>{detail().shortlink.crawlable ? 'Allowed' : 'Blocked'}</dd></div>
						<div><dt>Maximum visits</dt><dd>{detail().shortlink.maxVisits?.toLocaleString() ?? 'Unlimited'}</dd></div>
						<div><dt>Expires</dt><dd><Show when={detail().shortlink.validUntil} fallback="Never">{(date) => new Date(date()).toLocaleString()}</Show></dd></div>
						<Show when={detail().shortlink.tags.length > 0}>
							<div><dt>Tags</dt><dd class="tag-list"><For each={detail().shortlink.tags}>{(tag) => <span>{tag}</span>}</For></dd></div>
						</Show>
					</dl>
				</section>
				<section class="detail-card qr-card" aria-labelledby="shortlink-qr-heading">
					<h2 id="shortlink-qr-heading">QR code</h2>
					<QrCode
						label={`QR code for ${detail().shortlink.shortCode}`}
						title={detail().shortlink.shortCode}
						url={detail().shortlink.shortUrl}
						color="#8f361b"
					/>
				</section>
			</div>

			<section class="detail-card visits-card" aria-labelledby="recent-visits-heading">
				<h2 id="recent-visits-heading">Recent visits</h2>
				<div class="data-table-scroll">
					<table class="data-table">
						<caption class="visually-hidden">Twenty most recent nonbot visits</caption>
						<thead><tr><th scope="col">Date</th><th scope="col">Referrer</th><th scope="col">Location</th><th scope="col">User agent</th></tr></thead>
						<tbody>
							<Show when={detail().recentVisits.length > 0} fallback={<tr><td colspan="4">No visits yet.</td></tr>}>
								<For each={detail().recentVisits}>
									{(visit) => (
										<tr>
											<td>{new Date(visit.date).toLocaleString()}</td>
											<td>{visit.referer || '(direct)'}</td>
											<td>{visit.location ? [visit.location.city, visit.location.countryCode].filter(Boolean).join(', ') || '—' : '—'}</td>
											<td class="user-agent">{visit.userAgent || '—'}</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
				<Show when={detail().totalVisits > detail().recentVisits.length}>
					<p class="table-note">Showing {detail().recentVisits.length} of {detail().totalVisits.toLocaleString()} nonbot visits.</p>
				</Show>
			</section>

			<ConfirmDialog
				open={dialog() === 'reset'}
				title="Reset visit history?"
				description={`Delete all tracked visits for ${detail().shortlink.shortCode}? This cannot be undone.`}
				confirmLabel="Reset visits"
				pending={pending()}
				error={dialogError()}
				onOpenChange={(open) => !open && setDialog(null)}
				onConfirm={() => void resetVisits()}
			/>
			<ConfirmDialog
				open={dialog() === 'delete'}
				title="Delete shortlink?"
				description={`Permanently delete ${detail().shortlink.shortCode}? This cannot be undone.`}
				confirmLabel="Delete shortlink"
				pending={pending()}
				error={dialogError()}
				onOpenChange={(open) => !open && setDialog(null)}
				onConfirm={() => void removeShortlink()}
			/>
		</section>
	);
}
