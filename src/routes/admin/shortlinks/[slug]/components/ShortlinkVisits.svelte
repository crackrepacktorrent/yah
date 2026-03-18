<script lang="ts">
  import { Section, EmptyState, DataTable } from "$lib/components/admin";
  import { createSvelteTable, renderSnippet } from "$lib/components/admin";
  import { createColumnHelper, getCoreRowModel } from "@tanstack/table-core";
  import type { Visit, Pagination } from '$lib/server/shlink';

  let {
    visits,
    pagination,
  }: {
    visits: Visit[];
    pagination: Pagination;
  } = $props();

  const columnHelper = createColumnHelper<Visit>();

  const columns = [
    columnHelper.accessor("date", {
      header: "Date",
      cell: (info) => renderSnippet(dateCell, info.getValue()),
    }),
    columnHelper.accessor("referer", {
      header: "Referer",
      cell: (info) => renderSnippet(refererCell, info.getValue()),
    }),
    columnHelper.display({
      id: "location",
      header: "Location",
      cell: (info) => renderSnippet(locationCell, info.row.original),
    }),
    columnHelper.accessor("userAgent", {
      header: "User Agent",
      cell: (info) => renderSnippet(uaCell, info.getValue()),
    }),
  ];
</script>

{#snippet dateCell(date: string)}
  <span class="cell-date">{new Date(date).toLocaleString()}</span>
{/snippet}

{#snippet refererCell(referer: string)}
  <span class="referer">{referer || "(direct)"}</span>
{/snippet}

{#snippet locationCell(visit: Visit)}
  {#if visit.visitLocation}
    {visit.visitLocation.cityName || ""}{visit.visitLocation.cityName && visit.visitLocation.countryCode ? ", " : ""}{visit.visitLocation.countryCode || ""}
  {:else}
    —
  {/if}
{/snippet}

{#snippet uaCell(ua: string)}
  <span class="ua">{ua || "—"}</span>
{/snippet}

<Section title="Recent Visits">
  {#if visits.length === 0}
    <EmptyState message="No visits yet." />
  {:else}
    {@const table = createSvelteTable({
      data: visits,
      columns,
      getCoreRowModel: getCoreRowModel(),
})}
    <DataTable {table} />
    {#if pagination.totalItems > 20}
      <p class="more">Showing 20 of {pagination.totalItems} visits</p>
    {/if}
  {/if}
</Section>

<style>
  .referer {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-muted);
  }

  .ua {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-muted);
    font-size: 0.8rem;
  }

  .more {
    text-align: center;
    color: var(--color-muted);
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }
</style>
