export { createSvelteTable } from './table.svelte';
export { default as FlexRender } from './flex-render.svelte';
export { renderComponent, renderSnippet } from './render-helpers';
export type { RenderComponentConfig, RenderSnippetConfig } from './render-helpers';
import type { ColumnDef } from '@tanstack/table-core';
import SelectCheckbox from './SelectCheckbox.svelte';
import { renderComponent } from './render-helpers';

/** Multi-select checkbox column filter: shows row if its value is in the selected array. */
export const multiSelectFilter = (row: any, columnId: string, filterValue: unknown[]) => {
	if (!filterValue || filterValue.length === 0) return true;
	return filterValue.includes(row.getValue(columnId));
};

/** Creates a row-selection checkbox column for DataTable. */
export function createSelectColumn<TData>(): ColumnDef<TData, unknown> {
	return {
		id: 'select',
		header: ({ table }) =>
			renderComponent(SelectCheckbox, {
				checked: table.getIsAllRowsSelected(),
				indeterminate: table.getIsSomeRowsSelected(),
				onchange: table.getToggleAllRowsSelectedHandler(),
			}),
		cell: ({ row }) =>
			renderComponent(SelectCheckbox, {
				checked: row.getIsSelected(),
				disabled: !row.getCanSelect(),
				onchange: row.getToggleSelectedHandler(),
			}),
		enableSorting: false,
		enableColumnFilter: false,
	};
}

