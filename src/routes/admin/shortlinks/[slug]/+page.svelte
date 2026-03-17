<script lang="ts">
  import { page } from "$app/stores";
  import { Card, QRCode, Breadcrumb, Section, Spinner } from "$lib/components/admin";
  import { getShortUrl } from "../../shortlinks.remote";

  import ShortlinkStats from "./components/ShortlinkStats.svelte";
  import ShortlinkDetails from "./components/ShortlinkDetails.svelte";
  import ShortlinkEditor from "./components/ShortlinkEditor.svelte";
  import ShortlinkVisits from "./components/ShortlinkVisits.svelte";

  let slug = $derived($page.params.slug);
  let query = $derived(slug ? getShortUrl(slug) : null);
</script>

{#if query}
  {#if query.current}
    {@const data = query.current}

    <Breadcrumb
      items={[
        { label: "Shortlinks", href: "/admin/shortlinks" },
        { label: data.shortUrl.title || data.shortUrl.shortCode },
      ]}
    />

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
      />
      <ShortlinkVisits
        visits={data.visits}
        pagination={data.visitsPagination}
      />
    </div>
  {:else if query.loading}
    <Spinner size={48} centered />
  {:else if query.error}
    <p class="alert alert-error">Failed to load shortlink.</p>
  {/if}
{/if}

<style>
  .alert {
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
  }

  .alert-error {
    color: var(--color-destructive);
    background: var(--color-destructive-bg);
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
