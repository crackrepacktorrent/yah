import {
	createTable,
	type RowData,
	type TableOptions,
	type TableOptionsResolved,
	type TableState,
	type Updater
} from '@tanstack/table-core';

/**
 * Creates a reactive TanStack table for Svelte 5.
 *
 * The table is wrapped in $state so Svelte can track mutations from
 * setOptions() and re-render components that read from it.
 */
export function createSvelteTable<TData extends RowData>(
	options: TableOptions<TData>
) {
	const resolvedOptions = mergeObjects(
		{
			state: {},
			onStateChange() {},
			renderFallbackValue: null,
		},
		options
	) as TableOptionsResolved<TData>;

	const table = createTable(resolvedOptions);
	let state = $state<TableState>(table.initialState);

	function updateOptions() {
		table.setOptions(() => {
			return mergeObjects(resolvedOptions, options, {
				state: mergeObjects(state, options.state || {}),
				onStateChange: (updater: Updater<TableState>) => {
					if (updater instanceof Function) state = updater(state);
					else state = mergeObjects(state, updater);
					options.onStateChange?.(updater);
				},
			}) as TableOptionsResolved<TData>;
		});
	}

	updateOptions();

	$effect.pre(() => {
		state;
		updateOptions();
	});

	return table;
}

/**
 * Lazily merges objects via Proxy, preserving getter semantics.
 * Last source wins for key conflicts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeObjects(...sources: any[]): any {
	const resolve = (src: any) =>
		typeof src === 'function' ? (src() ?? undefined) : src;

	const findSourceWithKey = (key: PropertyKey) => {
		for (let i = sources.length - 1; i >= 0; i--) {
			const obj = resolve(sources[i]);
			if (obj && key in obj) return obj;
		}
		return undefined;
	};

	return new Proxy(Object.create(null), {
		get(_, key) {
			return findSourceWithKey(key)?.[key as never];
		},
		has(_, key) {
			return !!findSourceWithKey(key);
		},
		ownKeys() {
			const all = new Set<string | symbol>();
			for (const s of sources) {
				const obj = resolve(s);
				if (obj) {
					for (const k of Reflect.ownKeys(obj)) {
						all.add(k);
					}
				}
			}
			return [...all];
		},
		getOwnPropertyDescriptor(_, key) {
			const src = findSourceWithKey(key);
			if (!src) return undefined;
			return {
				configurable: true,
				enumerable: true,
				value: (src as any)[key],
				writable: true,
			};
		},
	}) as any;
}
