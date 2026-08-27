import { describe, expect, it, vi } from 'vitest';
import type { CampaignAnalyticsPoint, CampaignAnalyticsQuery } from './contracts';
import {
	readAuthorizedCampaignAnalytics,
	type CampaignAnalyticsServiceDependencies,
} from './service';

const validQuery: CampaignAnalyticsQuery = {
	campaignIds: [7, 11],
	metric: 'clicks',
	from: '2026-08-01',
	to: '2026-08-27',
};
const points: CampaignAnalyticsPoint[] = [
	{ campaignId: 7, count: 3, timestamp: '2026-08-01T00:00:00Z' },
];

function dependencies(): CampaignAnalyticsServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		reader: { read: vi.fn(async () => points) },
	};
}

describe('campaign analytics service boundary', () => {
	it('enforces exactly campaign:view before exactly one reader call', async () => {
		const deps = dependencies();
		const headers = new Headers({ cookie: 'session=owner' });

		await expect(readAuthorizedCampaignAnalytics(validQuery, headers, deps)).resolves.toBe(points);
		expect(deps.enforcePermissions).toHaveBeenCalledOnce();
		expect(deps.enforcePermissions).toHaveBeenCalledWith(headers, { campaign: ['view'] });
		expect(deps.reader.read).toHaveBeenCalledOnce();
		expect(deps.reader.read).toHaveBeenCalledWith(validQuery);
		expect(vi.mocked(deps.enforcePermissions).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(deps.reader.read).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
	});

	it('rejects invalid input before authorization or provider access', async () => {
		const invalidInputs = [
			{ ...validQuery, campaignIds: [] },
			{ ...validQuery, campaignIds: [7, 7] },
			{ ...validQuery, from: '2026-08-28', to: '2026-08-27' },
			{ ...validQuery, metric: 'opens' },
		];

		for (const input of invalidInputs) {
			const deps = dependencies();
			await expect(readAuthorizedCampaignAnalytics(input, new Headers(), deps)).rejects.toThrow();
			expect(deps.enforcePermissions).not.toHaveBeenCalled();
			expect(deps.reader.read).not.toHaveBeenCalled();
		}
	});

	it('does not reach the provider when campaign viewing is denied', async () => {
		const deps = dependencies();
		vi.mocked(deps.enforcePermissions).mockRejectedValue(new Error('Forbidden'));

		await expect(readAuthorizedCampaignAnalytics(validQuery, new Headers(), deps)).rejects.toThrow(
			'Forbidden',
		);
		expect(deps.enforcePermissions).toHaveBeenCalledOnce();
		expect(deps.reader.read).not.toHaveBeenCalled();
	});
});
