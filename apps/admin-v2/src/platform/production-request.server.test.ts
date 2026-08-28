import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
	getServerRequest: vi.fn<() => Request>(),
	requireProductionRuntime: vi.fn<() => void>(),
	surfaceError: vi.fn<(error: unknown) => never>(),
}));

vi.mock('./request', () => ({ getServerRequest: boundary.getServerRequest }));
vi.mock('./runtime.server', () => ({ requireProductionRuntime: boundary.requireProductionRuntime }));
vi.mock('./errors', () => ({ surfaceError: boundary.surfaceError }));

import { runProductionRequest } from './production-request.server';

describe('runProductionRequest', () => {
	beforeEach(() => {
		boundary.getServerRequest.mockReset();
		boundary.requireProductionRuntime.mockReset();
		boundary.surfaceError.mockReset();
		boundary.getServerRequest.mockReturnValue(new Request('https://admin.example.test/members'));
		boundary.surfaceError.mockImplementation((error) => {
			throw error;
		});
	});

	it('captures the request, gates the runtime, and returns the operation result', async () => {
		const calls: string[] = [];
		boundary.getServerRequest.mockImplementation(() => {
			calls.push('request');
			return new Request('https://admin.example.test/members', { headers: { cookie: 'session=one' } });
		});
		boundary.requireProductionRuntime.mockImplementation(() => {
			calls.push('runtime');
		});

		const result = await runProductionRequest(async (request) => {
			calls.push('operation');
			await Promise.resolve();
			return request.headers.get('cookie');
		});

		expect(result).toBe('session=one');
		expect(calls).toEqual(['request', 'runtime', 'operation']);
	});

	it('surfaces runtime-gate failures without invoking the operation', async () => {
		const error = new Error('not production');
		const operation = vi.fn(async () => 'unreachable');
		boundary.requireProductionRuntime.mockImplementation(() => {
			throw error;
		});

		await expect(runProductionRequest(operation)).rejects.toBe(error);
		expect(operation).not.toHaveBeenCalled();
		expect(boundary.surfaceError).toHaveBeenCalledWith(error);
	});

	it('surfaces operation failures', async () => {
		const error = new Error('provider failed');

		await expect(
			runProductionRequest(async () => {
				throw error;
			}),
		).rejects.toBe(error);
		expect(boundary.surfaceError).toHaveBeenCalledWith(error);
	});

	it('leaves a missing request outside error translation, matching the existing boundary', async () => {
		const error = new Error('A server request is required.');
		boundary.getServerRequest.mockImplementation(() => {
			throw error;
		});

		await expect(runProductionRequest(async () => undefined)).rejects.toBe(error);
		expect(boundary.requireProductionRuntime).not.toHaveBeenCalled();
		expect(boundary.surfaceError).not.toHaveBeenCalled();
	});
});
