import type { CampaignStatus, CampaignType } from './contracts';

export function campaignTypeLabel(type: CampaignType): string {
	return type === 'regular' ? 'Regular' : 'Confirmation';
}

export function campaignStatusLabel(status: CampaignStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}
