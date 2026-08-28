import { MAX_BULK_CAMPAIGN_DELETIONS, type CampaignStatus, type CampaignType } from './contracts';

export function bulkDraftSelectionIds(campaigns: ReadonlyArray<{ id: number; status: CampaignStatus }>): number[] {
	return campaigns
		.filter((campaign) => campaign.status === 'draft')
		.slice(0, MAX_BULK_CAMPAIGN_DELETIONS)
		.map((campaign) => campaign.id);
}

export function campaignTypeLabel(type: CampaignType): string {
	return type === 'regular' ? 'Regular' : 'Confirmation';
}

export function campaignStatusLabel(status: CampaignStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}
