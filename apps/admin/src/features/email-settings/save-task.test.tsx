import { createRoot, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revalidate } from '@solidjs/router';
import { toast } from '~/ui/toast';
import { createEmailSettingsSave } from './save-task';

vi.mock('@solidjs/router', () => ({ revalidate: vi.fn() }));
vi.mock('~/ui/toast', () => ({ toast: { success: vi.fn() } }));

const disposers: Array<() => void> = [];

function createSaveTask(save = vi.fn(async (_command: { name: string }) => ({ needsRestart: false }))) {
	let dispose!: () => void;
	const task = createRoot((cleanup) => {
		dispose = cleanup;
		return createEmailSettingsSave({
			save,
			queryKey: 'email-general-settings',
			savedMessage: 'General email settings saved.',
			failureMessage: 'Settings could not be saved.',
		});
	});
	disposers.push(dispose);
	return { task, dispose, save };
}

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('email settings saves', () => {
	it('rejects overlapping saves and shares the command lock with SMTP tests', async () => {
		let resolve!: () => void;
		const save = vi.fn(async (_command: { name: string }) => {
			await new Promise<void>((accept) => { resolve = accept; });
			return { needsRestart: false };
		});
		const { task } = createSaveTask(save);
		const first = task.save({ name: 'First' });
		await expect(task.save({ name: 'Duplicate' })).resolves.toBe(false);
		const smtpTest = vi.fn(async () => {});
		await expect(task.run(smtpTest, 'Test failed.')).resolves.toBe(false);
		expect(save).toHaveBeenCalledOnce();
		expect(smtpTest).not.toHaveBeenCalled();
		resolve();
		await expect(first).resolves.toBe(true);
	});

	it('waits for provider reload and coalesces refreshes after repeated saves', async () => {
		vi.useFakeTimers();
		const { task } = createSaveTask();
		await task.save({ name: 'First' });
		vi.advanceTimersByTime(1_000);
		await task.save({ name: 'Second' });
		vi.advanceTimersByTime(1_999);
		expect(revalidate).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(revalidate).toHaveBeenCalledExactlyOnceWith('email-general-settings');
		expect(toast.success).toHaveBeenLastCalledWith('General email settings saved. Listmonk is reloading and may be briefly unavailable.');
	});

	it('returns a failed save without refreshing or reporting success', async () => {
		vi.useFakeTimers();
		const { task } = createSaveTask(vi.fn(async (_command: { name: string }) => { throw new Error('Provider details'); }));
		await expect(task.save({ name: 'Failed' })).resolves.toBe(false);
		flush();
		expect(task.error()).toBe('Settings could not be saved.');
		vi.runAllTimers();
		expect(revalidate).not.toHaveBeenCalled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('defers an earlier refresh while a later save is running, even when that save fails', async () => {
		vi.useFakeTimers();
		const { task, save } = createSaveTask();
		await task.save({ name: 'Saved' });
		let reject!: (error: Error) => void;
		save.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
		const laterSave = task.save({ name: 'Still saving' });
		vi.advanceTimersByTime(3_000);
		expect(revalidate).not.toHaveBeenCalled();
		reject(new Error('Unavailable'));
		await expect(laterSave).resolves.toBe(false);
		vi.advanceTimersByTime(2_000);
		expect(revalidate).toHaveBeenCalledExactlyOnceWith('email-general-settings');
	});

	it('invalidates saved data when leaving and clears the deferred refresh', async () => {
		vi.useFakeTimers();
		const { task, dispose } = createSaveTask();
		await task.save({ name: 'Saved' });
		dispose();
		expect(revalidate).toHaveBeenCalledExactlyOnceWith('email-general-settings');
		vi.runAllTimers();
		expect(revalidate).toHaveBeenCalledOnce();
	});
});
