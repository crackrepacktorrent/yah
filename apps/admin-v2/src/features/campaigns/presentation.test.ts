import { describe, expect, it } from 'vitest';
import { MAX_BULK_CAMPAIGN_DELETIONS } from './contracts';
import { bulkDraftSelectionIds } from './presentation';

describe('campaign presentation', () => {
	it('selects at most the first 100 drafts in provider order', () => {
		const campaigns = [
			{ id: 1, status: 'finished' as const },
			...Array.from({ length: 101 }, (_, index) => ({ id: index + 2, status: 'draft' as const })),
		];

		expect(bulkDraftSelectionIds(campaigns)).toEqual(
			Array.from({ length: MAX_BULK_CAMPAIGN_DELETIONS }, (_, index) => index + 2),
		);
	});
});
