<script lang="ts">
  import { StatCard, Section } from "$lib/components/admin";

  let { shortUrl }: { shortUrl: any } = $props();
</script>

<Section title="Stats">
  <div class="stack">
    <StatCard value={shortUrl.visitsSummary.total} label="Total Clicks" />
    <StatCard value={shortUrl.visitsSummary.nonBots} label="Human" />
    <StatCard value={shortUrl.visitsSummary.bots} label="Bots" />
  </div>
</Section>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .stack > :global(*) {
    flex: 1;
  }
</style>
