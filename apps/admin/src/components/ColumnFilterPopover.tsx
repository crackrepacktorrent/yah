import { For, Show, createMemo, createSignal } from 'solid-js';
import { type Column } from '@tanstack/solid-table';
import { Popover } from '@kobalte/core/popover';
import './ColumnFilterPopover.css';

// Sentinel to represent "nothing selected" since TanStack normalizes [] to undefined.
const NONE_SELECTED = '__$$none$$__';

type Props<TData> = {
	column: Column<TData, unknown>;
};

export function ColumnFilterPopover<TData>(props: Props<TData>) {
	const [search, setSearch] = createSignal('');

	const facetedValues = createMemo(() => props.column.getFacetedUniqueValues());

	const rawFilterValue = createMemo(() => props.column.getFilterValue() as unknown[] | undefined);

	const noneSelected = createMemo(() => {
		const v = rawFilterValue();
		return Array.isArray(v) && v.length === 1 && v[0] === NONE_SELECTED;
	});

	const filterValue = createMemo(() => (noneSelected() ? [] : (rawFilterValue() ?? [])));

	const isFiltered = createMemo(() => rawFilterValue() != null && (rawFilterValue() as unknown[]).length > 0);

	const allSelected = createMemo(() => !isFiltered());

	const entries = createMemo(() => {
		const result: { value: unknown; label: string; count: number }[] = [];
		for (const [value, count] of facetedValues()) {
			const label = value == null ? '(empty)' : String(value);
			result.push({ value, label, count });
		}
		return result.sort((a, b) => a.label.localeCompare(b.label));
	});

	const filteredEntries = createMemo(() => {
		const s = search().toLowerCase();
		if (!s) return entries();
		return entries().filter((e) => e.label.toLowerCase().includes(s));
	});

	const allValues = createMemo(() => entries().map((e) => e.value));

	const someSelected = createMemo(
		() => !allSelected() && !noneSelected() && filterValue().length > 0,
	);

	function isChecked(value: unknown) {
		if (allSelected()) return true;
		if (noneSelected()) return false;
		return filterValue().includes(value);
	}

	function toggleValue(value: unknown) {
		if (allSelected()) {
			const included = allValues().filter((v) => v !== value);
			props.column.setFilterValue(included.length > 0 ? included : [NONE_SELECTED]);
		} else if (noneSelected()) {
			props.column.setFilterValue([value]);
		} else {
			const current = [...filterValue()];
			const idx = current.indexOf(value);
			if (idx >= 0) current.splice(idx, 1);
			else current.push(value);

			if (current.length >= allValues().length) props.column.setFilterValue(undefined);
			else if (current.length === 0) props.column.setFilterValue([NONE_SELECTED]);
			else props.column.setFilterValue(current);
		}
	}

	function toggleSelectAll() {
		if (allSelected()) props.column.setFilterValue([NONE_SELECTED]);
		else props.column.setFilterValue(undefined);
	}

	const headerLabel = createMemo(() => {
		const h = props.column.columnDef.header;
		return typeof h === 'string' ? h : 'column';
	});

	return (
		<Popover gutter={4} placement="bottom-start">
			<Popover.Trigger
				as="button"
				type="button"
				class={`filter-trigger${isFiltered() ? ' active' : ''}`}
				aria-label={`Filter ${headerLabel()}`}
				onClick={(e: MouseEvent) => e.stopPropagation()}
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
				</svg>
				<Show when={isFiltered()}>
					<span class="filter-dot" />
				</Show>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content class="filter-popover">
					<div class="filter-search">
						<input
							class="filter-search-input"
							type="text"
							placeholder="Search…"
							value={search()}
							onInput={(e) => setSearch(e.currentTarget.value)}
						/>
					</div>
					<div class="filter-header">
						<label class="filter-row">
							<input
								type="checkbox"
								checked={allSelected()}
								prop:indeterminate={someSelected()}
								onChange={toggleSelectAll}
							/>
							<span class="filter-value">Value</span>
							<span class="filter-count">Count</span>
						</label>
					</div>
					<div class="filter-list">
						<For each={filteredEntries()}>
							{(entry) => (
								<label class="filter-row">
									<input
										type="checkbox"
										checked={isChecked(entry.value)}
										onChange={() => toggleValue(entry.value)}
									/>
									<span class="filter-value">{entry.label}</span>
									<span class="filter-count">{entry.count}</span>
								</label>
							)}
						</For>
						<Show when={filteredEntries().length === 0}>
							<div class="filter-empty">No values found.</div>
						</Show>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover>
	);
}
