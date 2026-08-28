import { describe, expect, it, vi } from 'vitest';
import type { BouncePage, BounceSummary } from './contracts';
import {
	clearAuthorizedBounces,
	clearAuthorizedSubscriberBounces,
	deleteAuthorizedBounces,
	listAuthorizedBounces,
	listAuthorizedSubscriberBounces,
	type BounceServiceDependencies,
} from './service';

const hardBounce: BounceSummary = {
	id: 7,
	type: 'hard',
	source: 'smtp',
	createdAt: '2026-08-26T12:00:00Z',
	email: 'supporter@example.test',
	campaignName: 'August update',
};

const firstPage: BouncePage = {
	items: [hardBounce],
	total: 1,
	page: 1,
	requestedPage: 1,
	pageSize: 50,
};

function dependencies(): BounceServiceDependencies {
	return {
		authorization: { requirePermissions: vi.fn(async () => undefined), getCurrentUserId: vi.fn(async () => 'test-user') },
		manager: {
			list: vi.fn(async () => firstPage),
			listForSubscriber: vi.fn(async () => [hardBounce]),
			delete: vi.fn(async () => undefined),
			clearAll: vi.fn(async () => undefined),
			clearSubscriber: vi.fn(async () => undefined),
		},
	};
}

describe('bounce service boundary', () => {
	it('enforces the exact capability before every provider operation', async () => {
		const deps = dependencies();
		await listAuthorizedBounces({ page: 1 }, deps);
		await listAuthorizedSubscriberBounces(42, deps);
		await deleteAuthorizedBounces({ ids: [7, 8] }, deps);
		await clearAuthorizedBounces(deps);
		await clearAuthorizedSubscriberBounces(42, deps);

		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(1, { bounce: ['view'] });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(2, { bounce: ['view'] });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(3, { bounce: ['delete'] });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(4, { bounce: ['clear-all'] });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(5, { bounce: ['delete'] });
		expect(deps.manager.list).toHaveBeenCalledWith({ page: 1 });
		expect(deps.manager.listForSubscriber).toHaveBeenCalledWith(42);
		expect(deps.manager.delete).toHaveBeenCalledWith([7, 8]);
		expect(deps.manager.clearAll).toHaveBeenCalledOnce();
		expect(deps.manager.clearSubscriber).toHaveBeenCalledWith(42);
	});

	it('validates all inputs before authorization or provider access', async () => {
		const invalidInputs: Array<(deps: BounceServiceDependencies) => Promise<unknown>> = [
			(deps) => listAuthorizedBounces({ page: 10_001 }, deps),
			(deps) => listAuthorizedSubscriberBounces(0, deps),
			(deps) => deleteAuthorizedBounces({ ids: [] }, deps),
			(deps) => deleteAuthorizedBounces({ ids: [7, 7] }, deps),
			(deps) => deleteAuthorizedBounces(
				{ ids: Array.from({ length: 101 }, (_, index) => index + 1) },
				deps,
			),
			(deps) => clearAuthorizedSubscriberBounces(-1, deps),
		];

		for (const invoke of invalidInputs) {
			const deps = dependencies();
			await expect(invoke(deps)).rejects.toThrow();
			expect(deps.authorization.requirePermissions).not.toHaveBeenCalled();
			expect(deps.manager.list).not.toHaveBeenCalled();
			expect(deps.manager.listForSubscriber).not.toHaveBeenCalled();
			expect(deps.manager.delete).not.toHaveBeenCalled();
			expect(deps.manager.clearSubscriber).not.toHaveBeenCalled();
		}
	});

	it('does not reach the provider when authorization fails', async () => {
		const deps = dependencies();
		vi.mocked(deps.authorization.requirePermissions).mockRejectedValue(new Error('Forbidden'));

		await expect(listAuthorizedBounces({ page: 1 }, deps)).rejects.toThrow('Forbidden');
		await expect(listAuthorizedSubscriberBounces(42, deps)).rejects.toThrow('Forbidden');
		await expect(deleteAuthorizedBounces({ ids: [7] }, deps)).rejects.toThrow('Forbidden');
		await expect(clearAuthorizedBounces(deps)).rejects.toThrow('Forbidden');
		await expect(clearAuthorizedSubscriberBounces(42, deps)).rejects.toThrow('Forbidden');

		expect(deps.manager.list).not.toHaveBeenCalled();
		expect(deps.manager.listForSubscriber).not.toHaveBeenCalled();
		expect(deps.manager.delete).not.toHaveBeenCalled();
		expect(deps.manager.clearAll).not.toHaveBeenCalled();
		expect(deps.manager.clearSubscriber).not.toHaveBeenCalled();
	});
});
