import { can } from '@yah/admin-core/permissions';
import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { campaignStatusLabel, campaignTypeLabel } from '~/features/campaigns/presentation';
import { campaignHref } from '~/features/campaigns/routing';
import { deleteCampaigns, listCampaigns } from '~/features/campaigns/server';
import { MAX_BULK_CAMPAIGN_DELETIONS, type CampaignSummary } from '~/features/campaigns/contracts';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { PageHeader } from '~/ui/page-header';
import { createRowSelection } from '~/ui/row-selection';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/campaigns', {
	preload: () => void listCampaigns(),
});

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
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const deleteTask = createCommandTask();
	const drafts = createMemo(() => canDelete() ? props.campaigns.filter((campaign) => campaign.status === 'draft') : []);
	const selection = createRowSelection(drafts, { limit: MAX_BULK_CAMPAIGN_DELETIONS });

	async function handleDelete(): Promise<void> {
		const campaigns = selection.selected().map((campaign) => ({ id: campaign.id, expectedUpdatedAt: campaign.updatedAt }));
		await deleteTask.run(async () => {
			await deleteCampaigns({ campaigns });
			selection.clear();
			setDeleteOpen(false);
			revalidate(listCampaigns.key);
			toast.success('Draft campaigns deleted.');
		}, 'The selected campaigns could not be deleted.');
	}

	return (
		<section class="campaigns-page">
			<PageHeader eyebrow="Email delivery" title="Campaigns">
				<Show when={canCreate()}><a class="button" href="/emails/campaigns/new">New campaign</a></Show>
			</PageHeader>
			<Show when={selection.selected().length > 0}>
				<div class="bulk-actions campaign-selection" role="status"><span>{selection.selected().length} draft campaign{selection.selected().length === 1 ? '' : 's'} selected</span><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete selected</button><button class="button button--secondary" type="button" onClick={selection.clear}>Clear</button></div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Campaigns, delivery status, target lists, and progress</caption>
						<thead><tr><th scope="col"><SelectionCheckbox label={`Select up to ${MAX_BULK_CAMPAIGN_DELETIONS} draft campaigns`} checked={selection.all()} indeterminate={selection.some()} disabled={!canDelete() || drafts().length === 0} onChange={(event) => selection.setAll(event.currentTarget.checked)} /></th><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Type</th><th scope="col">Lists</th><th scope="col">Progress</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={props.campaigns.length > 0} fallback={<tr><td colspan="7">No campaigns are available.</td></tr>}>
								<For each={props.campaigns}>{(campaign) => <tr><td><SelectionCheckbox label={`Select ${campaign.name}`} checked={selection.has(campaign.id)} disabled={!canDelete() || campaign.status !== 'draft' || (selection.selected().length >= MAX_BULK_CAMPAIGN_DELETIONS && !selection.has(campaign.id))} onChange={(event) => selection.toggle(campaign.id, event.currentTarget.checked)} /></td><td><div class="campaign-name-cell"><a href={campaignHref(campaign.id)}>{campaign.name}</a><small>{campaign.subject}</small></div></td><td><span class={`badge campaign-status campaign-status--${campaign.status}`}>{campaignStatusLabel(campaign.status)}</span></td><td>{campaignTypeLabel(campaign.type)}</td><td><Show when={campaign.lists.length > 0} fallback="Deleted list"><div class="campaign-list-badges"><For each={campaign.lists}>{(list) => <span class="badge">{list.name}</span>}</For></div></Show></td><td>{campaign.sent.toLocaleString()} / {campaign.toSend.toLocaleString()}</td><td>{new Date(campaign.updatedAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<ConfirmDialog open={deleteOpen()} title="Delete selected draft campaigns?" description={`Permanently delete ${selection.selected().length} draft campaign${selection.selected().length === 1 ? '' : 's'}? This cannot be undone.`} confirmLabel="Delete campaigns" pending={deleteTask.pending()} error={deleteTask.error()} onConfirm={() => void handleDelete()} onOpenChange={setDeleteOpen} />
		</section>
	);
}
