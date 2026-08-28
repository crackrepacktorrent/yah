import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsSnapshot, SiteOverview } from './contracts';
import { readAuthorizedAnalytics, readAuthorizedSiteOverview } from './service';

const snapshot: AnalyticsSnapshot = {
	period: '7d',
	stats: { pageviews: 1, visitors: 1, visits: 1, bounceRate: 0, averageVisitSeconds: 1 },
	activeVisitors: 0,
	pageviews: [],
	pages: [],
	referrers: [],
	browsers: [],
	operatingSystems: [],
	devices: [],
	cities: [],
};
const overview: SiteOverview = {
	today: { pageviews: 100, visitors: 40, bounceRate: 20, averageVisitSeconds: 125 },
	month: { pageviews: 3_000, visitors: 1_200, bounceRate: 20, averageVisitSeconds: 125 },
};

describe('analytics service boundary', () => {
	it('rejects an invalid period before authorization or provider access', async () => {
		const enforcePermissions = vi.fn(async () => undefined);
		const getSnapshot = vi.fn(async () => snapshot);

		await expect(
			readAuthorizedAnalytics('year', {
				authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
				reader: { getSnapshot },
			}),
		).rejects.toThrow(
			'Invalid analytics period.',
		);
		expect(enforcePermissions).not.toHaveBeenCalled();
		expect(getSnapshot).not.toHaveBeenCalled();
	});

	it('never invokes Umami when server authorization fails', async () => {
		const enforcePermissions = vi.fn(async () => {
			throw new Error('forbidden');
		});
		const getSnapshot = vi.fn(async () => snapshot);

		await expect(
			readAuthorizedAnalytics('7d', {
				authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
				reader: { getSnapshot },
			}),
		).rejects.toThrow(
			'forbidden',
		);
		expect(enforcePermissions).toHaveBeenCalledWith({ analytics: ['view'] });
		expect(getSnapshot).not.toHaveBeenCalled();
	});

	it('passes only the validated period to the provider after authorization', async () => {
		const enforcePermissions = vi.fn(async () => undefined);
		const getSnapshot = vi.fn(async () => snapshot);

		await expect(
			readAuthorizedAnalytics('7d', {
				authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
				reader: { getSnapshot },
			}),
		).resolves.toBe(snapshot);
		expect(getSnapshot).toHaveBeenCalledWith('7d');
	});

	it('authorizes the narrow site overview independently', async () => {
		const enforcePermissions = vi.fn(async () => undefined);
		const getOverview = vi.fn(async () => overview);
		const dependencies = {
			authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
			reader: { getOverview },
		};
		await expect(readAuthorizedSiteOverview(dependencies)).resolves.toBe(overview);
		expect(enforcePermissions).toHaveBeenCalledWith({ analytics: ['view'] });

		enforcePermissions.mockRejectedValueOnce(new Error('forbidden'));
		await expect(readAuthorizedSiteOverview(dependencies)).rejects.toThrow('forbidden');
		expect(getOverview).toHaveBeenCalledOnce();
	});
});
