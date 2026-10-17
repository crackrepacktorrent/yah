import { createEffect, createMemo, createSignal } from 'solid-js';

/** Callers supply only actionable rows; selection never includes stale rows. */
export function createRowSelection<T extends { id: number }>(rows: () => readonly T[], options: { limit?: number; scope?: () => string | number } = {}) {
	const limit = options.limit ?? Infinity;
	const [ids, setIds] = createSignal<ReadonlySet<number>>(new Set());
	const available = createMemo(() => new Set(rows().map(({ id }) => id)));
	const selected = createMemo(() => rows().filter(({ id }) => ids().has(id)));
	const all = createMemo(() => available().size > 0 && rows().slice(0, limit).every(({ id }) => ids().has(id)));
	const some = createMemo(() => selected().length > 0 && !all());
	const clear = () => setIds(new Set<number>());
	if (options.scope) createEffect(options.scope, (scope, previous) => {
		if (previous !== undefined && scope !== previous) clear();
	});

	createEffect(available, (current) => {
		setIds((previous) => [...previous].every((id) => current.has(id))
			? previous : new Set([...previous].filter((id) => current.has(id))));
	});

	function toggle(id: number, checked: boolean): void {
		const currentRows = available();
		setIds((previous) => {
			const next = new Set([...previous].filter((selectedId) => currentRows.has(selectedId)));
			if (!checked) next.delete(id);
			else if (currentRows.has(id) && next.size < limit) next.add(id);
			return next;
		});
	}

	function setAll(checked: boolean): void {
		setIds(new Set(checked ? rows().slice(0, limit).map(({ id }) => id) : []));
	}

	return { selected, all, some, clear, toggle, setAll, has: (id: number) => available().has(id) && ids().has(id) };
}
