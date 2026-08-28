import { createRoot, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { createPublicError } from '~/platform/errors';
import { createCommandTask } from './command-task';

const disposers: Array<() => void> = [];

function task() {
	return createRoot((dispose) => {
		disposers.push(dispose);
		return createCommandTask();
	});
}

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('createCommandTask', () => {
	it('tracks pending work while leaving success handling inside the caller-owned command', async () => {
		const commandTask = task();
		let resolve!: () => void;
		let handled = false;
		const result = commandTask.run(async () => {
			await new Promise<void>((accept) => { resolve = accept; });
			handled = true;
		}, 'Failed.');
		flush();

		expect(commandTask.pending()).toBe(true);
		resolve();
		await expect(result).resolves.toBeUndefined();
		flush();
		expect(handled).toBe(true);
		expect(commandTask.pending()).toBe(false);
		expect(commandTask.error()).toBe('');
	});

	it('preserves public command errors and hides arbitrary failure details', async () => {
		const commandTask = task();

		await expect(commandTask.run(async () => { throw createPublicError('Approved detail.', 409); }, 'Fallback.'))
			.resolves.toBeUndefined();
		flush();
		expect(commandTask.error()).toBe('Approved detail.');

		await expect(commandTask.run(async () => { throw new Error('provider secret'); }, 'Safe fallback.'))
			.resolves.toBeUndefined();
		flush();
		expect(commandTask.pending()).toBe(false);
		expect(commandTask.error()).toBe('Safe fallback.');
	});
});
