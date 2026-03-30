import { createAsync, type RouteDefinition, useNavigate, useParams, revalidate } from '@solidjs/router';
import { For, Show, batch, createEffect, createMemo, createSignal, on, untrack } from 'solid-js';
import { Lock } from 'lucide-solid';
import { createSolidTable, getCoreRowModel, createColumnHelper } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Breadcrumb, Button, Card, AlertDialog,
	DataTable, FormField, Input, QRCode, Section, StatCard, Switch, TagInput, Tooltip,
} from '~/components';
import { requireSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import {
	getShortUrl, getShortUrlVisits,
	editShortUrl, deleteShortUrl, resetShortUrlVisits,
} from '../shortlinks.server';
import type { ShortUrl, Visit } from '~/server/shlink';
import './[slug].css';

export const route: RouteDefinition = {
	preload: ({ params }) => {
		void getShortUrl(params['slug'] ?? '');
		void getShortUrlVisits(params['slug'] ?? '');
	},
};

export default function ShortlinkDetailPage() {
	const params = useParams<{ slug: string }>();
	const session = createAsync(() => requireSession());
	const shortUrl = createAsync(() => getShortUrl(params.slug));
	const visitsData = createAsync(() => getShortUrlVisits(params.slug));

	const canEdit = createMemo(() => can(session(), 'shortlink', 'edit'));

	return (
		<>
			<Show when={shortUrl()}>
				{(url) => (
					<>
						<Breadcrumb items={[
							{ label: 'Shortlinks', href: '/admin/shortlinks' },
							{ label: url().title ?? url().shortCode },
						]} />

						<div class="detail-top">
							<ShortlinkStats shortUrl={url()} />
							<ShortlinkDetails shortUrl={url()} />
							<Section title="QR Code" fill>
								<Card class="qr-card">
									<QRCode url={url().shortUrl} title={url().shortCode} />
								</Card>
							</Section>
						</div>

						<div class="detail-bottom">
							<Show when={canEdit()}>
								<ShortlinkEditor shortUrl={url()} slug={params.slug} />
							</Show>
							<Show when={visitsData()}>
								{(vd) => <ShortlinkVisits visits={vd().visits} total={vd().pagination.totalItems} />}
							</Show>
						</div>
					</>
				)}
			</Show>
		</>
	);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function ShortlinkStats(props: { shortUrl: ShortUrl }) {
	return (
		<Section title="Stats" fill>
			<div class="stats-stack">
				<StatCard value={props.shortUrl.visitsSummary.total} label="Total Clicks" />
				<StatCard value={props.shortUrl.visitsSummary.nonBots} label="Human" />
				<StatCard value={props.shortUrl.visitsSummary.bots} label="Bots" />
			</div>
		</Section>
	);
}

// ─── Details ──────────────────────────────────────────────────────────────────

function ShortlinkDetails(props: { shortUrl: ShortUrl }) {
	return (
		<Section title="Details" fill>
			<div class="details-stack">
				<Card>
					<span class="detail-label">Short URL</span>
					<a href={props.shortUrl.shortUrl} target="_blank" rel="noopener">{props.shortUrl.shortUrl}</a>
				</Card>
				<Card>
					<span class="detail-label">Destination</span>
					<Tooltip text={props.shortUrl.longUrl}>
						<a href={props.shortUrl.longUrl} target="_blank" rel="noopener" class="detail-long-url">
							{props.shortUrl.longUrl}
						</a>
					</Tooltip>
				</Card>
				<Card>
					<span class="detail-label">Created</span>
					<span>{new Date(props.shortUrl.dateCreated).toLocaleString()}</span>
				</Card>
				<Show when={props.shortUrl.tags.length > 0}>
					<Card>
						<span class="detail-label">Tags</span>
						<div class="cell-badges">
							<For each={props.shortUrl.tags}>{(tag) => <Badge>{tag}</Badge>}</For>
						</div>
					</Card>
				</Show>
				<Card>
					<span class="detail-label">Options</span>
					<div class="cell-badges">
						<Badge variant={props.shortUrl.crawlable ? 'success' : 'default'}>
							{props.shortUrl.crawlable ? 'Crawlable' : 'Not crawlable'}
						</Badge>
						<Badge variant={props.shortUrl.forwardQuery ? 'success' : 'default'}>
							{props.shortUrl.forwardQuery ? 'Forwards query' : 'No query forwarding'}
						</Badge>
						<Show when={props.shortUrl.meta.maxVisits}>
							{(max) => <Badge variant="warning">Max {max()} visits</Badge>}
						</Show>
						<Show when={props.shortUrl.meta.validUntil}>
							{(until) => (
								<Badge variant="warning">Expires {new Date(until()).toLocaleDateString()}</Badge>
							)}
						</Show>
					</div>
				</Card>
			</div>
		</Section>
	);
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function ShortlinkEditor(props: { shortUrl: ShortUrl; slug: string }) {
	const navigate = useNavigate();

	const [unlocked, setUnlocked] = createSignal(false);
	const [saving, setSaving] = createSignal(false);
	const [confirmUnlock, setConfirmUnlock] = createSignal(false);
	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmReset, setConfirmReset] = createSignal(false);

	// Form fields initialized from props — untrack so we read props once at mount
	// without creating a reactive dependency (signals are the source of truth after init)
	const [longUrl, setLongUrl] = createSignal(untrack(() => props.shortUrl.longUrl));
	const [title, setTitle] = createSignal(untrack(() => props.shortUrl.title ?? ''));
	const [tags, setTags] = createSignal<string[]>(untrack(() => [...props.shortUrl.tags]));
	const [maxVisits, setMaxVisits] = createSignal(untrack(() => props.shortUrl.meta.maxVisits?.toString() ?? ''));
	const [validUntil, setValidUntil] = createSignal(untrack(() => props.shortUrl.meta.validUntil?.slice(0, 10) ?? ''));
	const [crawlable, setCrawlable] = createSignal(untrack(() => props.shortUrl.crawlable));
	const [forwardQuery, setForwardQuery] = createSignal(untrack(() => props.shortUrl.forwardQuery));

	// Reset form when navigating to a different shortlink
	createEffect(on(
		() => props.shortUrl.shortCode,
		() => {
			const url = props.shortUrl;
			batch(() => {
				setLongUrl(url.longUrl);
				setTitle(url.title ?? '');
				setTags([...url.tags]);
				setMaxVisits(url.meta.maxVisits?.toString() ?? '');
				setValidUntil(url.meta.validUntil?.slice(0, 10) ?? '');
				setCrawlable(url.crawlable);
				setForwardQuery(url.forwardQuery);
				setUnlocked(false);
			});
		},
		{ defer: true },
	));

	async function handleSave() {
		setSaving(true);
		try {
			await editShortUrl({
				shortCode: props.shortUrl.shortCode,
				longUrl: longUrl(),
				title: title() || undefined,
				tags: tags(),
				maxVisits: maxVisits() ? parseInt(maxVisits(), 10) || null : null,
				validUntil: validUntil() || undefined,
				crawlable: crawlable(),
				forwardQuery: forwardQuery(),
			});
			setUnlocked(false);
			toast.success('Shortlink updated.');
			await revalidate('getShortUrl');
		} catch (err) {
			toastError(err, 'Failed to save changes.');
		} finally {
			setSaving(false);
		}
	}

	async function handleResetVisits() {
		try {
			const result = await resetShortUrlVisits(props.shortUrl.shortCode);
			toast.success(`Deleted ${result.deletedCount} visit(s).`);
			await revalidate('getShortUrlVisits');
		} catch (err) {
			toastError(err, 'Failed to reset visits.');
		}
	}

	async function handleDelete() {
		try {
			await deleteShortUrl(props.shortUrl.shortCode);
			toast.success('Shortlink deleted.');
			await revalidate('listShortUrls');
			navigate('/admin/shortlinks');
		} catch (err) {
			toastError(err, 'Failed to delete shortlink.');
		}
	}

	return (
		<Section title="Settings">
			<Card>
				<div class="editor-inner">
					<Show when={!unlocked()}>
						<div class="lock-overlay" onClick={() => setConfirmUnlock(true)}>
							<div class="lock-center">
								<Lock size={28} />
								<span>Click to edit</span>
							</div>
						</div>
					</Show>

					<fieldset disabled={!unlocked()} class="edit-fieldset">
						<div class="form-fields">
							<FormField label="Destination URL">
								<Input value={longUrl()} onInput={(e) => setLongUrl(e.currentTarget.value)} required />
							</FormField>
							<FormField label="Title">
								<Input value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
							</FormField>
							<FormField label="Tags" hint="Press Enter to add">
								<TagInput tags={tags()} onChange={setTags} disabled={!unlocked()} />
							</FormField>
							<div class="form-row">
								<FormField label="Max Visits">
									<Input type="number" placeholder="Unlimited" value={maxVisits()} onInput={(e) => setMaxVisits(e.currentTarget.value)} />
								</FormField>
								<FormField label="Expires">
									<Input type="date" value={validUntil()} onInput={(e) => setValidUntil(e.currentTarget.value)} />
								</FormField>
							</div>
							<div class="switches">
								<Switch label="Forward query parameters" checked={forwardQuery()} onChange={setForwardQuery} disabled={!unlocked()} />
								<Switch label="Allow search engine crawling" checked={crawlable()} onChange={setCrawlable} disabled={!unlocked()} />
							</div>
						</div>
					</fieldset>

					<div class="edit-actions">
						<Button onClick={handleSave} disabled={!unlocked() || saving()}>
							{saving() ? 'Saving…' : 'Save Changes'}
						</Button>
						<Button variant="danger-outline" disabled={!unlocked()} onClick={() => setConfirmReset(true)}>
							Reset Visits
						</Button>
						<Button variant="danger-outline" disabled={!unlocked()} onClick={() => setConfirmDelete(true)}>
							Delete
						</Button>
					</div>
				</div>
			</Card>

			<AlertDialog
				open={confirmUnlock()}
				onOpenChange={setConfirmUnlock}
				title="Edit Shortlink"
				description="Are you sure you want to edit the settings for this shortlink?"
				confirmLabel="Yes, edit"
				variant="primary"
				onconfirm={() => { setUnlocked(true); }}
			/>
			<AlertDialog
				open={confirmReset()}
				onOpenChange={setConfirmReset}
				title="Reset Visit Stats"
				description="Reset all visit stats for this shortlink? This cannot be undone."
				confirmLabel="Yes, reset visits"
				onconfirm={handleResetVisits}
			/>
			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title="Delete Shortlink"
				description={`Permanently delete ${props.shortUrl.shortCode}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>
		</Section>
	);
}

// ─── Visits ───────────────────────────────────────────────────────────────────

const visitColumnHelper = createColumnHelper<Visit>();

const visitColumns = [
	visitColumnHelper.accessor('date', {
		header: 'Date',
		cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleString()}</span>,
	}),
	visitColumnHelper.accessor('referer', {
		header: 'Referer',
		cell: (info) => <span class="visit-referer">{info.getValue() || '(direct)'}</span>,
	}),
	visitColumnHelper.display({
		id: 'location',
		header: 'Location',
		cell: (info) => {
			const loc = info.row.original.visitLocation;
			const parts = loc ? [loc.cityName, loc.countryCode].filter(Boolean).join(', ') : '';
			return (
				<Show when={loc} fallback={<span class="cell-muted">—</span>}>
					<span>{parts || '—'}</span>
				</Show>
			);
		},
	}),
	visitColumnHelper.accessor('userAgent', {
		header: 'User Agent',
		cell: (info) => <span class="visit-ua">{info.getValue() || '—'}</span>,
	}),
];

function ShortlinkVisits(props: { visits: Visit[]; total: number }) {
	const table = createSolidTable({
		get data() { return props.visits; },
		columns: visitColumns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnFilters: false,
		enableSorting: false,
	});

	return (
		<Section title="Recent Visits">
			<DataTable table={table} emptyMessage="No visits yet." />
			<Show when={props.total > props.visits.length}>
				<p class="visits-more">Showing {props.visits.length} of {props.total} visits</p>
			</Show>
		</Section>
	);
}
