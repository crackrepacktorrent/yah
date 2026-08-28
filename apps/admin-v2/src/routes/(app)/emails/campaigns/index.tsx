import { can } from '@yah/admin-core/permissions';
import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { bulkDraftSelectionIds, campaignStatusLabel, campaignTypeLabel } from '~/features/campaigns/presentation';
import { campaignHref } from '~/features/campaigns/routing';
import { deleteCampaigns, listCampaigns } from '~/features/campaigns/server';
import { MAX_BULK_CAMPAIGN_DELETIONS, type CampaignSummary } from '~/features/campaigns/contracts';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { PageHeader } from '~/ui/page-header';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/campaigns', {
	preload: () => void listCampaigns(),
});

function statusClass(status: CampaignSummary['status']): string {
	return `badge campaign-status campaign-status--${status}`;
}

export default function CampaignListPage() {
	const campaigns = createMemo(() => listCampaigns());
	return <Show when={campaigns()}>{(rows) => <CampaignTable campaigns={rows()} />}</Show>;
}

function CampaignTable(props: { campaigns: CampaignSummary[] }) {
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(
		() =>
			can(session(), 'campaign', 'create') &&
			can(session(), 'list', 'view'),
	);
	const canDelete = createMemo(() => can(session(), 'campaign', 'delete'));
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const [deletePending, setDeletePending] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal('');
	const drafts = createMemo(() => props.campaigns.filter((campaign) => campaign.status === 'draft'));
	const selected = createMemo(() => drafts().filter((campaign) => selectedIds().includes(campaign.id)));
	const bulkDraftIds = createMemo(() => bulkDraftSelectionIds(props.campaigns));
	const allBulkDraftsSelected = createMemo(() => bulkDraftIds().length > 0 && bulkDraftIds().every((id) => selectedIds().includes(id)));
	const someDraftsSelected = createMemo(() => selected().length > 0 && !allBulkDraftsSelected());

	function toggleCampaign(id: number, checked: boolean): void {
		setSelectedIds((current) => {
			if (!checked) return current.filter((selectedId) => selectedId !== id);
			if (current.includes(id) || selected().length >= MAX_BULK_CAMPAIGN_DELETIONS) return current;
			return [...current, id];
		});
	}

	async function handleDelete(): Promise<void> {
		setDeletePending(true);
		setDeleteError('');
		try {
			await deleteCampaigns({ campaigns: selected().map((campaign) => ({ id: campaign.id, expectedUpdatedAt: campaign.updatedAt })) });
			setSelectedIds([]);
			setDeleteOpen(false);
			revalidate(listCampaigns.key);
			toast.success('Draft campaigns deleted.');
		} catch (caught) {
			setDeleteError(visibleError(caught, 'The selected campaigns could not be deleted.'));
		} finally {
			setDeletePending(false);
		}
	}

	return (
		<section class="campaigns-page">
			<PageHeader eyebrow="Email delivery" title="Campaigns">
				<Show when={canCreate()}><a class="button" href="/emails/campaigns/new">New campaign</a></Show>
			</PageHeader>
			<Show when={selected().length > 0}>
				<div class="bulk-actions campaign-selection" role="status"><span>{selected().length} draft campaign{selected().length === 1 ? '' : 's'} selected</span><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete selected</button><button class="button button--secondary" type="button" onClick={() => setSelectedIds([])}>Clear</button></div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Campaigns, delivery status, target lists, and progress</caption>
						<thead><tr><th scope="col"><SelectionCheckbox label={`Select up to ${MAX_BULK_CAMPAIGN_DELETIONS} draft campaigns`} checked={allBulkDraftsSelected()} indeterminate={someDraftsSelected()} disabled={!canDelete() || drafts().length === 0} onChange={(event) => setSelectedIds(event.currentTarget.checked ? bulkDraftIds() : [])} /></th><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Type</th><th scope="col">Lists</th><th scope="col">Progress</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={props.campaigns.length > 0} fallback={<tr><td colspan="7">No campaigns are available.</td></tr>}>
								<For each={props.campaigns}>{(campaign) => <tr><td><SelectionCheckbox label={`Select ${campaign.name}`} checked={selectedIds().includes(campaign.id)} disabled={!canDelete() || campaign.status !== 'draft' || (selected().length >= MAX_BULK_CAMPAIGN_DELETIONS && !selectedIds().includes(campaign.id))} onChange={(event) => toggleCampaign(campaign.id, event.currentTarget.checked)} /></td><td><div class="campaign-name-cell"><a href={campaignHref(campaign.id)}>{campaign.name}</a><small>{campaign.subject}</small></div></td><td><span class={statusClass(campaign.status)}>{campaignStatusLabel(campaign.status)}</span></td><td>{campaignTypeLabel(campaign.type)}</td><td><Show when={campaign.lists.length > 0} fallback="Deleted list"><div class="campaign-list-badges"><For each={campaign.lists}>{(list) => <span class="badge">{list.name}</span>}</For></div></Show></td><td>{campaign.sent.toLocaleString()} / {campaign.toSend.toLocaleString()}</td><td>{new Date(campaign.updatedAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<ConfirmDialog open={deleteOpen()} title="Delete selected draft campaigns?" description={`Permanently delete ${selected().length} draft campaign${selected().length === 1 ? '' : 's'}? This cannot be undone.`} confirmLabel="Delete campaigns" pending={deletePending()} error={deleteError()} onConfirm={() => void handleDelete()} onOpenChange={setDeleteOpen} />
		</section>
	);
}
