<script lang="ts">
  import { page } from "$app/state";
  import { Card, QRCode, Breadcrumb, Section, Spinner } from "$lib/components/admin";
  import { getShortUrl, getShortUrlVisits } from "../../shortlinks.remote";

  import ShortlinkStats from "./components/ShortlinkStats.svelte";
  import ShortlinkDetails from "./components/ShortlinkDetails.svelte";
  import ShortlinkEditor from "./components/ShortlinkEditor.svelte";
  import ShortlinkVisits from "./components/ShortlinkVisits.svelte";

  let slug = $derived(page.params.slug);
  let shortUrlQuery = $derived(slug ? getShortUrl(slug) : null);
  let visitsQuery = $derived(slug ? getShortUrlVisits(slug) : null);
</script>

{#if shortUrlQuery}
  {#if shortUrlQuery.current}
    {@const shortUrl = shortUrlQuery.current}

    <Breadcrumb
      items={[
        { label: "Shortlinks", href: "/admin/shortlinks" },
        { label: shortUrl.title || shortUrl.shortCode },
      ]}
    />

    <div class="top-row">
      <ShortlinkStats {shortUrl} />
      <ShortlinkDetails {shortUrl} />
      <Section title="QR Code">
        <Card class="qr-card">
          <QRCode url={shortUrl.shortUrl} title={shortUrl.shortCode} />
        </Card>
      </Section>
    </div>

    <div class="bottom-row">
      {#key slug}
        <ShortlinkEditor
          {shortUrl}
          slug={slug!}
        />
      {/key}
      {#if visitsQuery?.current}
        <ShortlinkVisits
          visits={visitsQuery.current.visits}
          pagination={visitsQuery.current.pagination}
        />
      {/if}
    </div>
  {:else if shortUrlQuery.loading}
    <Spinner size={48} centered />
  {:else if shortUrlQuery.error}
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

  @media (max-width: 1024px) {
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

  @media (max-width: 1024px) {
    .bottom-row {
      grid-template-columns: 1fr;
    }
  }
</style>
