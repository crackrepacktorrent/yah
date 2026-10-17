import { createRoot, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicError } from '~/platform/errors';
import { createPreviewTask } from './preview-task';

const disposers: Array<() => void> = [];
function setup() {
	return createRoot((dispose) => {
		disposers.push(dispose);
		return { preview: createPreviewTask(), dispose };
	});
}
function deferred() {
	let resolve!: (html: string) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<string>((accept, fail) => { resolve = accept; reject = fail; });
	return { promise, resolve, reject };
}
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose(); });

describe('preview task', () => {
	it('guards duplicate requests before disabled controls commit', async () => {
		const { preview } = setup();
		const request = deferred();
		const render = vi.fn(() => request.promise);
		const first = preview.load(render, 'Failed.');
		await preview.load(render, 'Failed.');
		flush();
		expect(render).toHaveBeenCalledTimes(1);
		expect(preview.pending()).toBe(true);
		request.resolve('<p>Preview</p>');
		await first;
		flush();
		expect(preview.html()).toBe('<p>Preview</p>');
		expect(preview.pending()).toBe(false);
	});

	it.each(['resolve', 'reject'] as const)('ignores an invalidated request that later %ss during a newer render', async (settle) => {
		const { preview } = setup();
		const old = deferred();
		const next = deferred();
		const first = preview.load(() => old.promise, 'Old failure.');
		preview.clear();
		const second = preview.load(() => next.promise, 'New failure.');
		if (settle === 'resolve') old.resolve('Stale HTML');
		else old.reject(new Error('Stale failure'));
		await first;
		flush();
		expect(preview.pending()).toBe(true);
		expect(preview.html()).toBe('');
		expect(preview.error()).toBe('');
		next.resolve('Current HTML');
		await second;
		flush();
		expect(preview.html()).toBe('Current HTML');
	});

	it('does not reopen a closed preview or publish results after disposal', async () => {
		const { preview, dispose } = setup();
		const request = deferred();
		const load = preview.load(() => request.promise, 'Failed.');
		preview.clear();
		request.resolve('Closed');
		await load;
		flush();
		expect(preview.html()).toBe('');
		const late = deferred();
		const afterNavigation = preview.load(() => late.promise, 'Failed.');
		dispose();
		late.resolve('Unmounted');
		await afterNavigation;
		flush();
		expect(preview.html()).toBe('');
	});

	it('clears a stale preview on failure and displays only safe error details', async () => {
		const { preview } = setup();
		await preview.load(async () => 'Old HTML', 'Failed.');
		await preview.load(async () => { throw new Error('private upstream detail'); }, 'Safe fallback.');
		flush();
		expect(preview.html()).toBe('');
		expect(preview.error()).toBe('Safe fallback.');
		await preview.load(async () => { throw createPublicError('Invalid template.', 400); }, 'Safe fallback.');
		flush();
		expect(preview.error()).toBe('Invalid template.');
	});
});
