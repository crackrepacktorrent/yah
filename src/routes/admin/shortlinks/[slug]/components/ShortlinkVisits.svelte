<script lang="ts">
  import { Table, Section } from "$lib/components/admin";

  let {
    visits,
    pagination,
  }: {
    visits: any[];
    pagination: any;
  } = $props();
</script>

<Section title="Recent Visits">
  {#if visits.length === 0}
    <p class="empty">No visits yet.</p>
  {:else}
    <Table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Referer</th>
          <th>Location</th>
          <th>User Agent</th>
        </tr>
      </thead>
      <tbody>
        {#each visits as visit}
          <tr>
            <td class="date">{new Date(visit.date).toLocaleString()}</td>
            <td class="referer">{visit.referer || "(direct)"}</td>
            <td>
              {#if visit.visitLocation}
                {visit.visitLocation.cityName || ""}{visit.visitLocation.cityName && visit.visitLocation.countryCode ? ", " : ""}{visit.visitLocation.countryCode || ""}
              {:else}
                —
              {/if}
            </td>
            <td class="ua">{visit.userAgent || "—"}</td>
          </tr>
        {/each}
      </tbody>
    </Table>
    {#if pagination.totalItems > 20}
      <p class="more">Showing 20 of {pagination.totalItems} visits</p>
    {/if}
  {/if}
</Section>

<style>
  .date {
    white-space: nowrap;
    color: var(--color-muted);
  }

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

  .empty {
    color: var(--color-muted);
  }
</style>
