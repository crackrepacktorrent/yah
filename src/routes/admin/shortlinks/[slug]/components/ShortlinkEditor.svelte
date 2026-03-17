<script lang="ts">
  import { goto } from "$app/navigation";
  import { Card, Button, FormField, Switch, ConfirmDialog, Section } from "$lib/components/admin";
  import { editShortUrl, deleteShortUrl, resetShortUrlVisits, getShortUrl } from "../../../shortlinks.remote";

  let {
    shortUrl,
    slug,
    oneditSuccess,
  }: {
    shortUrl: any;
    slug: string;
    oneditSuccess: () => void;
  } = $props();

  let unlocked = $state(false);
  let dirty = $state(false);
  let confirmUnlock = $state(false);
  let confirmDelete = $state(false);
  let confirmReset = $state(false);

  let resetForm: HTMLFormElement;
  let deleteForm: HTMLFormElement;

  function markDirty() {
    dirty = true;
  }

  $effect(() => {
    slug;
    unlocked = false;
    dirty = false;
  });
</script>

<Section title="Settings">
  <Card>
    <div class="settings-inner">
      <div class="lock-wrapper">
        <button
          class="lock-btn"
          onclick={() => unlocked ? (unlocked = false) : (confirmUnlock = true)}
          aria-label={unlocked ? "Lock editing" : "Unlock editing"}
        >
          {#if unlocked}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          {/if}
        </button>
      </div>

      <ConfirmDialog
        bind:open={confirmUnlock}
        title="Edit Shortlink"
        description="Are you sure you want to edit the settings for this shortlink?"
        confirmLabel="Yes, edit"
        variant="primary"
        onconfirm={() => { unlocked = true; confirmUnlock = false; }}
      />

      <form
        {...editShortUrl.enhance(async ({ submit }) => {
          await submit();
          if (editShortUrl.result?.success) {
            unlocked = false;
            dirty = false;
            oneditSuccess();
            getShortUrl(slug).refresh();
          }
        })}
        class="edit-form"
        oninput={markDirty}
        onchange={markDirty}
      >
        <input {...editShortUrl.fields.shortCode.as("text")} type="hidden" value={shortUrl.shortCode} />

        <fieldset disabled={!unlocked} class="edit-fieldset">
          <FormField label="Destination URL">
            <input {...editShortUrl.fields.longUrl.as("url")} class="admin-input" value={shortUrl.longUrl} required />
          </FormField>

          <FormField label="Title">
            <input {...editShortUrl.fields.title.as("text")} class="admin-input" value={shortUrl.title ?? ""} />
          </FormField>

          <FormField label="Tags" hint="(comma-separated)">
            <input {...editShortUrl.fields.tags.as("text")} class="admin-input" value={shortUrl.tags.join(", ")} />
          </FormField>

          <div class="row">
            <FormField label="Max Visits">
              <input {...editShortUrl.fields.maxVisits.as("text")} class="admin-input" value={shortUrl.meta.maxVisits ?? ""} placeholder="Unlimited" />
            </FormField>

            <FormField label="Expires">
              <input {...editShortUrl.fields.validUntil.as("text")} type="date" class="admin-input" min={new Date().toLocaleDateString("en-CA")} value={shortUrl.meta.validUntil?.slice(0, 10) ?? ""} />
            </FormField>
          </div>

          <div class="switches">
            <Switch label="Forward query parameters" checked={shortUrl.forwardQuery} name="forwardQuery" disabled={!unlocked} />
            <Switch label="Allow search engine crawling" checked={shortUrl.crawlable} name="crawlable" disabled={!unlocked} />
          </div>
        </fieldset>

        <div class="edit-actions">
          <Button variant="primary" type="submit" disabled={!unlocked || !dirty || editShortUrl.pending}>
            {editShortUrl.pending ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="danger-outline" disabled={!unlocked} onclick={() => (confirmReset = true)}>Reset Visits</Button>
          <Button variant="danger-outline" disabled={!unlocked} onclick={() => (confirmDelete = true)}>Delete</Button>
        </div>
      </form>
    </div>
  </Card>

  <ConfirmDialog
    bind:open={confirmReset}
    title="Reset Visit Stats"
    description="Reset all visit stats for this shortlink? This cannot be undone."
    confirmLabel="Yes, reset visits"
    onconfirm={() => resetForm?.requestSubmit()}
  />

  <ConfirmDialog
    bind:open={confirmDelete}
    title="Delete Shortlink"
    description="Permanently delete {shortUrl.shortCode}? This cannot be undone."
    confirmLabel="Yes, delete"
    onconfirm={() => deleteForm?.requestSubmit()}
  />

  <form
    bind:this={resetForm}
    {...resetShortUrlVisits.enhance(async ({ submit }) => {
      await submit();
      confirmReset = false;
      getShortUrl(slug).refresh();
    })}
    hidden
  >
    <input {...resetShortUrlVisits.fields.shortCode.as("text")} type="hidden" value={shortUrl.shortCode} />
  </form>

  <form
    bind:this={deleteForm}
    {...deleteShortUrl.enhance(async ({ submit }) => {
      await submit();
      goto("/admin/shortlinks");
    })}
    hidden
  >
    <input {...deleteShortUrl.fields.shortCode.as("text")} type="hidden" value={shortUrl.shortCode} />
  </form>
</Section>

<style>
  .settings-inner {
    position: relative;
  }

  .lock-wrapper {
    position: absolute;
    top: -1rem;
    right: -1rem;
    z-index: 1;
  }

  .lock-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.35rem;
    cursor: pointer;
    color: var(--color-muted);
    display: flex;
    align-items: center;
    transition: color 0.15s, border-color 0.15s;
  }

  .lock-btn:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .edit-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .edit-fieldset:disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }

  .switches {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .edit-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-top: 1.25rem;
  }
</style>
