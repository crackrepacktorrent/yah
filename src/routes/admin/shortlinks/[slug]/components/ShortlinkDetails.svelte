<script lang="ts">
  import { Card, Badge, Tooltip, Section } from "$lib/components/admin";

  let { shortUrl }: { shortUrl: any } = $props();
</script>

<Section title="Details">
  <div class="stack">
    <Card>
      <span class="label">Short URL</span>
      <a href={shortUrl.shortUrl} target="_blank" rel="noopener">{shortUrl.shortUrl}</a>
    </Card>
    <Card>
      <span class="label">Destination</span>
      <Tooltip text={shortUrl.longUrl}>
        <a href={shortUrl.longUrl} target="_blank" rel="noopener" class="long-url">{shortUrl.longUrl}</a>
      </Tooltip>
    </Card>
    <Card>
      <span class="label">Created</span>
      <span>{new Date(shortUrl.dateCreated).toLocaleString()}</span>
    </Card>
    {#if shortUrl.tags.length > 0}
      <Card>
        <span class="label">Tags</span>
        <div class="tags">
          {#each shortUrl.tags as tag}
            <Badge>{tag}</Badge>
          {/each}
        </div>
      </Card>
    {/if}
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

  .label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-muted);
    margin-bottom: 0.25rem;
  }

  .long-url {
    font-size: 0.9rem;
    color: var(--color-foreground);
    word-break: break-all;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
