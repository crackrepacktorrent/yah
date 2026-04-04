import { createAsync, revalidate, type RouteDefinition, useNavigate } from '@solidjs/router';
import { For, Show, batch, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, createColumnHelper, type SortingState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import * as v from 'valibot';
import {
	Badge, Button, Input, Switch, FormField,
	AlertDialog, Dialog, DataTable, PageHeader, TagInput,
	createSelectColumn, type RowSelectionState,
} from '~/components';
import { requireSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import { createForm } from '~/lib/use-form';
import {
	listShortUrls, createShortUrl, deleteShortUrl,
} from '../shortlinks.server';
import type { ShortUrl } from '~/server/shlink';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listShortUrls(); },
};

const columnHelper = createColumnHelper<ShortUrl>();

// ─── Form schema ──────────────────────────────────────────────────────────────

const CreateSchema = v.object({
	longUrl: v.pipe(v.string(), v.nonEmpty('Destination URL is required'), v.url('Must be a valid URL')),
	slug: v.string(),
	title: v.string(),
	tags: v.array(v.string()),
	maxVisits: v.string(),
	validUntil: v.string(),
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
});

type CreateValues = v.InferOutput<typeof CreateSchema>;

const initialValues: CreateValues = {
	longUrl: '',
	slug: '',
	title: '',
	tags: [],
	maxVisits: '',
	validUntil: '',
	crawlable: false,
	forwardQuery: true,
};

export default function ShortlinksPage() {
	const navigate = useNavigate();
	const session = createAsync(() => requireSession());
	const urls = createAsync(() => listShortUrls());

	// ─── Table state ────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [sorting, setSorting] = createSignal<SortingState>([{ id: 'dateCreated', desc: true }]);

	// ─── Dialog state ────────────────────────────────────────────────────────────

	const [createOpen, setCreateOpen] = createSignal(false);
	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [createPending, setCreatePending] = createSignal(false);

	// ─── Create form ──────────────────────────────────────────────────────────────

	const form = createForm(CreateSchema, initialValues);

	// ─── Permissions ─────────────────────────────────────────────────────────────

	const canCreate = createMemo(() => can(session(), 'shortlink', 'create'));
	const canDelete = createMemo(() => can(session(), 'shortlink', 'delete'));

	// ─── Table ───────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<ShortUrl>(),
		columnHelper.accessor('shortCode', {
			header: 'Short URL',
			enableSorting: true,
			cell: (info) => (
				<span>
					<a href={`/admin/shortlinks/${info.getValue()}`} class="code">{info.getValue()}</a>
					<Show when={info.row.original.title}>
						<><br /><span class="row-title">{info.row.original.title}</span></>
					</Show>
				</span>
			),
		}),
		columnHelper.accessor('longUrl', {
			header: 'Destination',
			enableSorting: true,
			cell: (info) => <span class="long-url" title={info.getValue()}>{info.getValue()}</span>,
		}),
		columnHelper.accessor('tags', {
			header: 'Tags',
			enableSorting: false,
			cell: (info) => (
				<div class="cell-badges">
					<For each={info.getValue()}>{(tag) => <Badge>{tag}</Badge>}</For>
				</div>
			),
		}),
		columnHelper.accessor((row) => row.visitsSummary.total, {
			id: 'visits',
			header: 'Clicks',
			enableSorting: true,
			cell: (info) => <span class="clicks">{info.getValue()}</span>,
		}),
		columnHelper.accessor('dateCreated', {
			id: 'dateCreated',
			header: 'Created',
			enableSorting: true,
			cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
		}),
	];

	const table = createSolidTable({
		get data() { return urls() ?? []; },
		columns,
		state: {
			get globalFilter() { return globalFilter(); },
			get rowSelection() { return rowSelection(); },
			get sorting() { return sorting(); },
		},
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		globalFilterFn: (row, _colId, filterValue: string) => {
			const s = filterValue.toLowerCase();
			return (
				row.original.shortCode.toLowerCase().includes(s) ||
				row.original.longUrl.toLowerCase().includes(s) ||
				(row.original.title?.toLowerCase().includes(s) ?? false) ||
				row.original.tags.some((t) => t.toLowerCase().includes(s))
			);
		},
		enableRowSelection: () => canDelete(),
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	const handleCreate = form.handleSubmit(async (values) => {
		setCreatePending(true);
		try {
			const result = await createShortUrl({
				longUrl: values.longUrl,
				customSlug: values.slug || undefined,
				title: values.title || undefined,
				tags: values.tags,
				maxVisits: values.maxVisits ? parseInt(values.maxVisits, 10) || null : null,
				validUntil: values.validUntil || undefined,
				crawlable: values.crawlable,
				forwardQuery: values.forwardQuery,
			});
			batch(() => {
				setCreateOpen(false);
				form.reset();
			});
			toast.success('Shortlink created.');
			navigate(`/admin/shortlinks/${result.shortCode}`);
		} catch (err) {
			toastError(err, 'Failed to create shortlink.');
		} finally {
			setCreatePending(false);
		}
	});

	async function handleDelete() {
		const rows = selectedRows();
		try {
			await Promise.all(rows.map((url) => deleteShortUrl(url.shortCode)));
			toast.success(`${rows.length} shortlink${rows.length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listShortUrls');
		} catch (err) {
			toastError(err, 'Failed to delete shortlinks.');
		}
	}

	// ─── Toolbar ──────────────────────────────────────────────────────────────────

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Filter shortlinks…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Show when={canCreate()}>
						<Button onClick={() => { form.reset(); setCreateOpen(true); }}>+ New Shortlink</Button>
					</Show>
				</div>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>Clear</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Shortlinks" />

			<DataTable table={table} toolbar={toolbar} />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Shortlink${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} shortlink${selectedRows().length > 1 ? 's' : ''}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			<Show when={canCreate()}>
				<Dialog
					open={createOpen()}
					onOpenChange={(open) => batch(() => { if (!open) form.reset(); setCreateOpen(open); })}
					title="New Shortlink"
					maxWidth="520px"
					footer={<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
						<Button onClick={handleCreate} disabled={createPending()}>
							{createPending() ? 'Creating…' : 'Create Shortlink'}
						</Button>
					</>}
				>
					<div class="form-fields">
						<FormField label="Destination URL" required error={form.fieldError('longUrl')}>
							<Input type="url" placeholder="https://example.com/long/path" {...form.field('longUrl')} />
						</FormField>

						<FormField label="Custom Slug" hint="Optional — leave blank for auto-generated">
							<Input placeholder="my-link" {...form.field('slug')} />
						</FormField>

						<FormField label="Title" hint="Optional">
							<Input placeholder="Descriptive title" {...form.field('title')} />
						</FormField>

						<FormField label="Tags" hint="Press Enter to add">
							<TagInput
								tags={form.values.tags}
								onChange={(tags) => form.setValue('tags', tags)}
								placeholder="Add a tag…"
							/>
						</FormField>

						<div class="form-row">
							<FormField label="Max Visits" hint="Optional">
								<Input type="number" placeholder="Unlimited" {...form.field('maxVisits')} />
							</FormField>
							<FormField label="Expires" hint="Optional">
								<Input type="date" {...form.field('validUntil')} />
							</FormField>
						</div>

						<div class="switches">
							<Switch
								label="Forward query parameters"
								checked={form.values.forwardQuery}
								onChange={(v) => form.setValue('forwardQuery', v)}
							/>
							<Switch
								label="Allow search engine crawling"
								checked={form.values.crawlable}
								onChange={(v) => form.setValue('crawlable', v)}
							/>
						</div>

					</div>
				</Dialog>
			</Show>
		</>
	);
}
