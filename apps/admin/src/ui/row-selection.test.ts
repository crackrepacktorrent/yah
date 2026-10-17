import { createRoot, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_BULK_CAMPAIGN_DELETIONS } from '~/features/campaigns/contracts';
import { createRowSelection } from './row-selection';

const disposers: Array<() => void> = [];
function setup<T>(create: () => T): T {
	return createRoot((dispose) => { disposers.push(dispose); return create(); });
}
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose(); });

describe('row selection', () => {
	it('selects at most the first 100 actionable campaigns in provider order', () => {
		const campaigns = [{ id: 1, status: 'finished' }, ...Array.from({ length: 101 }, (_, i) => ({ id: i + 2, status: 'draft' }))];
		const selection = setup(() => createRowSelection(() => campaigns.filter(({ status }) => status === 'draft'), { limit: MAX_BULK_CAMPAIGN_DELETIONS }));
		selection.setAll(true);
		flush();
		expect(selection.selected().map(({ id }) => id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 2));
		expect(selection.all()).toBe(true);
		expect(selection.some()).toBe(false);
		selection.toggle(102, true);
		flush();
		expect(selection.has(102)).toBe(false);
		selection.toggle(2, false);
		flush();
		expect(selection.some()).toBe(true);
		selection.toggle(102, true);
		flush();
		expect(selection.has(102)).toBe(true);
		expect(selection.selected()).toHaveLength(100);
	});

	it('enforces eligibility and the limit even for multiple changes before a flush', () => {
		const selection = setup(() => createRowSelection(() => [{ id: 1 }, { id: 2 }, { id: 3 }], { limit: 2 }));
		for (const id of [99, 1, 1, 2, 3]) selection.toggle(id, true);
		flush();
		expect(selection.selected().map(({ id }) => id)).toEqual([1, 2]);
		selection.setAll(false);
		flush();
		expect(selection.selected()).toEqual([]);
		expect(selection.all()).toBe(false);
	});

	it('uses refreshed row versions and drops rows that disappear or become ineligible', () => {
		const { selection, setRows } = setup(() => {
			const [rows, setRows] = createSignal([{ id: 1, version: 'old' }, { id: 2, version: 'old' }]);
			return { selection: createRowSelection(rows, { limit: 2 }), setRows };
		});
		selection.setAll(true);
		flush();
		setRows([{ id: 2, version: 'new' }]);
		flush();
		expect(selection.selected()).toEqual([{ id: 2, version: 'new' }]);
		expect(selection.has(1)).toBe(false);
		setRows([{ id: 1, version: 'returned' }, { id: 2, version: 'new' }]);
		flush();
		expect(selection.has(1)).toBe(false);
		selection.clear();
		flush();
		expect(selection.some()).toBe(false);
		setRows([]);
		flush();
		expect(selection.all()).toBe(false);
	});

	it('clears selection when the page or filter changes, including when returning to an earlier scope', () => {
		const { selection, setScope } = setup(() => {
			const [scope, setScope] = createSignal('1:search');
			return { selection: createRowSelection(() => [{ id: 1 }], { scope }), setScope };
		});
		flush();
		selection.setAll(true);
		flush();
		setScope('2:search');
		flush();
		expect(selection.selected()).toEqual([]);
		setScope('1:search');
		flush();
		expect(selection.selected()).toEqual([]);
	});
});
