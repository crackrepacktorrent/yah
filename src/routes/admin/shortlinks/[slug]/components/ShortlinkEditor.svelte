<script lang="ts">
  import { untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { Card, Button, FormField, Input, Switch, ConfirmDialog, Section, DatePicker, TagInput } from "$lib/components/admin";
  import { Lock, Unlock } from "lucide-svelte";
  import { editShortUrl, deleteShortUrl, resetShortUrlVisits, getShortUrl, getShortUrlVisits } from "../../../shortlinks.remote";
  import { getSession } from "../../../session.remote";
  import { can } from "../../../can";
  import { useForm } from "$lib/utils/use-form.svelte";
  import { toastError } from "$lib/utils/toast-error";
  import { today, getLocalTimeZone } from '@internationalized/date';
  import { toast } from "svelte-sonner";
  import * as v from "valibot";
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
  let saving = $state(false);
  let confirmUnlock = $state(false);
  let confirmDelete = $state(false);
  let confirmReset = $state(false);

  const schema = v.object({
    longUrl: v.pipe(v.string(), v.nonEmpty('Destination URL is required'), v.url('Must be a valid URL')),
    title: v.string(),
    tags: v.array(v.string()),
    maxVisits: v.string(),
    validUntil: v.string(),
    crawlable: v.boolean(),
    forwardQuery: v.boolean(),
  });

  const form = useForm(untrack(() => ({
    longUrl: shortUrl.longUrl,
    title: shortUrl.title ?? '',
    tags: [...shortUrl.tags],
    maxVisits: shortUrl.meta.maxVisits?.toString() ?? '',
    validUntil: shortUrl.meta.validUntil?.slice(0, 10) ?? '',
    crawlable: shortUrl.crawlable,
    forwardQuery: shortUrl.forwardQuery,
  })), schema);

  async function handleSave() {
    if (!form.validate()) return;
    saving = true;
    try {
      await editShortUrl({
        shortCode: shortUrl.shortCode,
        longUrl: form.values.longUrl,
        title: form.values.title,
        tags: form.values.tags,
        maxVisits: form.values.maxVisits ? (parseInt(form.values.maxVisits, 10) || null) : null,
        validUntil: form.values.validUntil,
        crawlable: form.values.crawlable,
        forwardQuery: form.values.forwardQuery,
      });
      unlocked = false;
      toast.success("Shortlink updated.");
      getShortUrl(slug).refresh();
    } catch (err) {
      toastError(err, "Failed to save changes.");
    } finally {
      saving = false;
    }
  }

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

      <div class="edit-form">
        <fieldset disabled={!unlocked} class="edit-fieldset">
          <FormField label="Destination URL" error={form.fieldError('longUrl')}>
            <Input bind:value={form.values.longUrl} onblur={() => form.touch('longUrl')} required />
          </FormField>

          <FormField label="Title">
            <Input bind:value={form.values.title} />
          </FormField>

          <FormField label="Tags" hint="Press Enter to add">
            <TagInput bind:tags={form.values.tags} placeholder="Add a tag..." disabled={!unlocked} />
          </FormField>

          <div class="form-row">
            <FormField label="Max Visits">
              <Input bind:value={form.values.maxVisits} placeholder="Unlimited" />
            </FormField>

            <FormField label="Expires">
              <DatePicker
                bind:value={form.values.validUntil}
                minValue={today(getLocalTimeZone())}
              />
            </FormField>
          </div>

          <div class="switches">
            <Switch label="Forward query parameters" bind:checked={form.values.forwardQuery} disabled={!unlocked} />
            <Switch label="Allow search engine crawling" bind:checked={form.values.crawlable} disabled={!unlocked} />
          </div>
        </fieldset>

        <div class="edit-actions">
          <Button variant="primary" onclick={handleSave} disabled={!unlocked || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="danger-outline" type="button" disabled={!unlocked} onclick={() => (confirmReset = true)}>Reset Visits</Button>
          <Button variant="danger-outline" type="button" disabled={!unlocked} onclick={() => (confirmDelete = true)}>Delete</Button>
        </div>
      </div>
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
