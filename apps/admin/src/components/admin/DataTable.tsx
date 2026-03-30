import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { flexRender, type Table, type ColumnDef, type FilterFn, type RowSelectionState } from '@tanstack/solid-table';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import './DataTable.css';

export type { ColumnDef, RowSelectionState };

export function DataTable<T,>(props: {
	table: Table<T>;
	toolbar?: () => JSX.Element;
	emptyMessage?: string;
}) {
	return (
		<div class="dt-wrapper">
			<Show when={props.toolbar}>
				<div class="dt-toolbar">{props.toolbar?.()}</div>
			</Show>
			<div class={`dt-scroll${props.toolbar ? ' dt-scroll--has-toolbar' : ''}`}>
				<table class="dt-table">
					<thead>
						<For each={props.table.getHeaderGroups()}>
							{(hg) => (
								<tr>
									<For each={hg.headers}>
										{(header) => {
											const canSort = header.column.getCanSort();
											const canFilter = header.column.getCanFilter();
											const sorted = () => header.column.getIsSorted();
											return (
												<th
													class={`dt-th${canSort ? ' dt-th--sort' : ''}${sorted() ? ' dt-th--sorted' : ''}`}
													style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}
													onClick={canSort ? (e: MouseEvent) => header.column.getToggleSortingHandler()?.(e) : undefined}
												>
													<Show when={!header.isPlaceholder}>
														<span class="dt-th-inner">
															{flexRender(header.column.columnDef.header, header.getContext())}
															<Show when={canSort}>
																<span class="dt-sort" aria-hidden="true">
																	{sorted() === 'asc' ? '↑' : sorted() === 'desc' ? '↓' : '↕'}
																</span>
															</Show>
															<Show when={canFilter}>
																<ColumnFilterPopover column={header.column} />
															</Show>
														</span>
													</Show>
												</th>
											);
										}}
									</For>
								</tr>
							)}
						</For>
					</thead>
					<tbody>
						<For each={props.table.getRowModel().rows}>
							{(row) => (
								<tr class={row.getIsSelected() ? 'dt-row--selected' : ''}>
									<For each={row.getVisibleCells()}>
										{(cell) => (
											<td class="dt-td">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
										)}
									</For>
								</tr>
							)}
						</For>
					</tbody>
				</table>
				<Show when={props.table.getRowModel().rows.length === 0}>
					<div class="dt-empty">{props.emptyMessage ?? 'No results.'}</div>
				</Show>
			</div>
		</div>
	);
}

/** Creates a row-selection checkbox column. */
export function createSelectColumn<T,>(): ColumnDef<T> {
	return {
		id: 'select',
		size: 40,
		enableSorting: false,
		header: (info) => (
			<input
				type="checkbox"
				class="row-checkbox"
				checked={info.table.getIsAllPageRowsSelected()}
				prop:indeterminate={info.table.getIsSomePageRowsSelected()}
				onChange={(e) => info.table.getToggleAllPageRowsSelectedHandler()(e)}
			/>
		),
		cell: (info) => (
			<input
				type="checkbox"
				class="row-checkbox"
				checked={info.row.getIsSelected()}
				disabled={!info.row.getCanSelect()}
				onChange={(e) => info.row.getToggleSelectedHandler()(e)}
			/>
		),
	};
}

/** Filter function for multi-select column filters. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const multiSelectFilter: FilterFn<any> = (row, columnId, filterValue: unknown[]) =>
	filterValue.includes(row.getValue(columnId));
multiSelectFilter.autoRemove = (val: unknown) => !Array.isArray(val) || val.length === 0;
