import { describe, expect, it, vi } from 'vitest';
import { listAuthorizedEmailLogs, type EmailLogServiceDependencies } from './service';

function dependencies(): EmailLogServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		manager: { list: vi.fn(async (input) => ({ lines: ['ready'], total: 1, page: 1, requestedPage: input.page, pageSize: 200 })) },
	};
}

describe('email log service boundary', () => {
	it('requires provider management because process logs are operationally sensitive', async () => {
		const deps = dependencies();
		await listAuthorizedEmailLogs({ page: 1 }, new Headers(), deps);
		expect(deps.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { provider: ['manage'] });
		expect(deps.manager.list).toHaveBeenCalledWith({ page: 1 });
	});

	it('validates before authorization and fails closed on denied access', async () => {
		const invalid = dependencies();
		await expect(listAuthorizedEmailLogs({ page: 0 }, new Headers(), invalid)).rejects.toThrow('valid log page');
		expect(invalid.enforcePermissions).not.toHaveBeenCalled();

		const denied = dependencies();
		vi.mocked(denied.enforcePermissions).mockRejectedValue(new Error('Forbidden'));
		await expect(listAuthorizedEmailLogs({ page: 1 }, new Headers(), denied)).rejects.toThrow('Forbidden');
		expect(denied.manager.list).not.toHaveBeenCalled();
	});
});
