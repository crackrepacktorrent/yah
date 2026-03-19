<script lang="ts">
  import { untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { Card, Button, FormField, Input, Switch, ConfirmDialog, Section, DatePicker, TagInput } from "$lib/components/admin";
  import { Lock, Unlock } from "lucide-svelte";
  import { editShortUrl, deleteShortUrl, resetShortUrlVisits, getShortUrl, getShortUrlVisits } from "../../../shortlinks.remote";
  import { getSession } from "../../../session.remote";
  import { can } from "../../../can";
  import { today, getLocalTimeZone } from '@internationalized/date';
  import { toast } from "svelte-sonner";
  import type { ShortUrl } from '$lib/server/shlink';

  let session = $derived(getSession().current);
  let canEdit = $derived(can(session, 'shortlink', 'edit'));

  let {
    shortUrl,
    slug,
  }: {
    shortUrl: ShortUrl;
    slug: string;
  } = $props();

  let unlocked = $state(false);
  let dirty = $state(false);
  let editTags = $state<string[]>([...untrack(() => shortUrl.tags)]);
  let confirmUnlock = $state(false);
  let confirmDelete = $state(false);
  let confirmReset = $state(false);

  function markDirty() {
    dirty = true;
  }

  $effect(() => {
    slug;
    unlocked = false;
    dirty = false;
    editTags = [...shortUrl.tags];
  });

  async function handleReset() {
    try {
      const result = await resetShortUrlVisits(shortUrl.shortCode);
      toast.success(`Deleted ${result.deletedCount} visit(s).`);
      getShortUrlVisits(slug).refresh();
    } catch (err) {
      toast.error("Failed to reset visits.");
    }
  }

  async function handleDelete() {
    try {
      await deleteShortUrl(shortUrl.shortCode);
      toast.success("Shortlink deleted.");
      goto("/admin/shortlinks");
    } catch (err) {
      toast.error("Failed to delete shortlink.");
    }
  }
</script>

{#if canEdit}
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
            <Unlock size={18} />
          {:else}
            <Lock size={18} />
          {/if}
        </button>
      </div>

      <ConfirmDialog
        bind:open={confirmUnlock}
        title="Edit Shortlink"
        description="Are you sure you want to edit the settings for this shortlink?"
        confirmLabel="Yes, edit"
        variant="primary"
        onconfirm={() => { unlocked = true; }}
      />

      <form
        {...editShortUrl.enhance(async ({ submit }) => {
          try {
            await submit();
            if ((editShortUrl.result as { success?: boolean })?.success) {
              unlocked = false;
              dirty = false;
              toast.success("Shortlink updated.");
              getShortUrl(slug).refresh();
            } else {
              const issues = editShortUrl.fields?.longUrl?.issues() ?? [];
              if (issues.length > 0) toast.error(issues[0]?.message ?? "Validation error");
            }
          } catch (err) {
            toast.error("Failed to save changes.");
          }
        })}
        class="edit-form"
        oninput={markDirty}
        onchange={markDirty}
      >
        <input {...editShortUrl.fields.shortCode.as("text")} type="hidden" value={shortUrl.shortCode} />

        <fieldset disabled={!unlocked} class="edit-fieldset">
          <FormField label="Destination URL">
            <Input {...editShortUrl.fields.longUrl.as("url")} value={shortUrl.longUrl} required />
          </FormField>

          <FormField label="Title">
            <Input {...editShortUrl.fields.title.as("text")} value={shortUrl.title ?? ""} />
          </FormField>

          <FormField label="Tags" hint="Press Enter to add">
            <input type="hidden" name="tags" value={editTags.join(", ")} />
            <TagInput bind:tags={editTags} placeholder="Add a tag..." disabled={!unlocked} />
          </FormField>

          <div class="form-row">
            <FormField label="Max Visits">
              <Input {...editShortUrl.fields.maxVisits.as("text")} value={shortUrl.meta.maxVisits?.toString() ?? ""} placeholder="Unlimited" />
            </FormField>

            <FormField label="Expires">
              <DatePicker
                value={shortUrl.meta.validUntil?.slice(0, 10) ?? ''}
                name="validUntil"
                minValue={today(getLocalTimeZone())}
              />
            </FormField>
          </div>

          <div class="switches">
            <Switch label="Forward query parameters" checked={shortUrl.forwardQuery} name="forwardQuery" disabled={!unlocked} />
            <Switch label="Allow search engine crawling" checked={shortUrl.crawlable} name="crawlable" disabled={!unlocked} />
          </div>
        </fieldset>

        <div class="edit-actions">
          <Button variant="primary" type="submit" disabled={!unlocked || !dirty || !!editShortUrl.pending}>
            {editShortUrl.pending ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="danger-outline" type="button" disabled={!unlocked} onclick={() => (confirmReset = true)}>Reset Visits</Button>
          <Button variant="danger-outline" type="button" disabled={!unlocked} onclick={() => (confirmDelete = true)}>Delete</Button>
        </div>
      </form>
    </div>
  </Card>

  <ConfirmDialog
    bind:open={confirmReset}
    title="Reset Visit Stats"
    description="Reset all visit stats for this shortlink? This cannot be undone."
    confirmLabel="Yes, reset visits"
    onconfirm={handleReset}
  />

  <ConfirmDialog
    bind:open={confirmDelete}
    title="Delete Shortlink"
    description="Permanently delete {shortUrl.shortCode}? This cannot be undone."
    confirmLabel="Yes, delete"
    onconfirm={handleDelete}
  />
</Section>
{/if}

<style>
  .settings-inner {
    position: relative;
  }

  .lock-wrapper {
    position: absolute;
    top: -1rem;
    right: -1rem;
    z-index: var(--z-base);
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
