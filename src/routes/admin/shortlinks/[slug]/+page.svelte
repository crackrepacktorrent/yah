<script lang="ts">
  import { page } from "$app/stores";
  import { Card, QRCode, Breadcrumb, Section } from "$lib/components/admin";
  import { getShortUrl, editShortUrl, resetShortUrlVisits } from "../../shortlinks.remote";

  import ShortlinkStats from "./components/ShortlinkStats.svelte";
  import ShortlinkDetails from "./components/ShortlinkDetails.svelte";
  import ShortlinkEditor from "./components/ShortlinkEditor.svelte";
  import ShortlinkVisits from "./components/ShortlinkVisits.svelte";

  let slug = $derived($page.params.slug);
  let editSuccess = $state(false);

  $effect(() => {
    if (editSuccess) {
      const timer = setTimeout(() => { editSuccess = false; }, 3000);
      return () => clearTimeout(timer);
    }
  });

  $effect(() => {
    slug;
    editSuccess = false;
  });
</script>

{#if slug}
  {#await getShortUrl(slug)}
    <p class="loading">Loading...</p>
  {:then data}
    <Breadcrumb
      items={[
        { label: "Shortlinks", href: "/admin/shortlinks" },
        { label: data.shortUrl.title || data.shortUrl.shortCode },
      ]}
    />

    {#each editShortUrl.fields.longUrl.issues() as issue}
      <p class="alert alert-error">{issue.message}</p>
    {/each}

    {#if editSuccess}
      <p class="alert alert-success">Shortlink updated.</p>
    {/if}

    {#if resetShortUrlVisits.result}
      <p class="alert alert-success">
        Deleted {resetShortUrlVisits.result.deletedCount} visit(s).
      </p>
    {/if}

    <div class="top-row">
      <ShortlinkStats shortUrl={data.shortUrl} />
      <ShortlinkDetails shortUrl={data.shortUrl} />
      <Section title="QR Code">
        <Card class="qr-card">
          <QRCode url={data.shortUrl.shortUrl} title={data.shortUrl.shortCode} />
        </Card>
      </Section>
    </div>

    <div class="bottom-row">
      <ShortlinkEditor
        shortUrl={data.shortUrl}
        {slug}
        oneditSuccess={() => { editSuccess = true; }}
      />
      <ShortlinkVisits
        visits={data.visits}
        pagination={data.visitsPagination}
      />
    </div>
  {/await}
{/if}

<style>
  .loading {
    color: var(--color-muted);
  }

  .alert {
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
  }

  .alert-error {
    color: var(--color-destructive);
    background: var(--color-destructive-bg);
  }

  .alert-success {
    color: var(--color-success);
    background: var(--color-success-bg);
  }

  .top-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: stretch;
  }

  :global(.qr-card) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 900px) {
    .top-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .top-row {
      grid-template-columns: 1fr;
    }
  }

  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
  }

  @media (max-width: 900px) {
    .bottom-row {
      grid-template-columns: 1fr;
    }
  }
</style>
