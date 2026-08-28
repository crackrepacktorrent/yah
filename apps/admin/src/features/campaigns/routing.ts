import { decodePositiveIntegerRouteSegment } from '~/platform/positive-integer-route-segment';

export function decodeCampaignRouteId(segment: string): number {
	return decodePositiveIntegerRouteSegment(segment);
}

export function campaignHref(id: number): string {
	return `/emails/campaigns/${id}`;
}
