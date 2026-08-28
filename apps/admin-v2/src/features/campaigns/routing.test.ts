import { describe, expect, it } from 'vitest';
import { campaignHref, decodeCampaignRouteId } from './routing';

describe('campaign routing', () => {
	it('builds detail links', () => expect(campaignHref(42)).toBe('/emails/campaigns/42'));
	it.each(['', '0', '01', '-1', '1.5', 'not-an-id', '9007199254740992'])(
		'rejects an invalid route ID: %s',
		(segment) => expect(decodeCampaignRouteId(segment)).toBe(0),
	);
	it('decodes a positive safe integer', () => expect(decodeCampaignRouteId('42')).toBe(42));
});
