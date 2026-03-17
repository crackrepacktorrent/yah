import {
	createTable,
	type RowData,
	type TableOptions,
	type TableOptionsResolved,
	type Table
} from '@tanstack/table-core';

/**
 * Creates a reactive TanStack table for Svelte 5.
 * Accepts a function that returns options so the $derived inside
 * can track reactive state (e.g. changing data, sorting).
 */
export function createSvelteTable<TData extends RowData>(
	options: () => TableOptions<TData>
): Table<TData> {
	const initial = options();
	const table = createTable({
		state: {},
		onStateChange() {},
		renderFallbackValue: null,
		...initial
	} as TableOptionsResolved<TData>);

	let tableState = $state(table.initialState);

	const resolvedOptions = $derived.by<TableOptionsResolved<TData>>(() => {
		const opts = options();
		return Object.assign(
			{ state: {}, onStateChange() {}, renderFallbackValue: null },
			opts,
			{
				state: { ...tableState, ...opts.state },
				onStateChange(updater: any) {
					if (typeof updater === 'function') {
						tableState = updater(tableState);
					} else {
						tableState = updater;
					}
					opts.onStateChange?.(updater);
				}
			}
		) as TableOptionsResolved<TData>;
	});

	$effect.pre(() => {
		table.setOptions(resolvedOptions);
	});

	return table;
}
