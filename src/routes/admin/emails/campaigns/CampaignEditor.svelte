<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge, Breadcrumb, Button, Card, ConfirmDialog, FormField, Input, Section, Spinner, Tabs, TabContent, DialogShell, Select, DatePicker, TagInput, MultiSelect } from '$lib/components/admin';
	import { onMount } from 'svelte';

	let RichTextEditor: any = $state(null);
	onMount(async () => {
		const mod = await import('$lib/components/admin/RichTextEditor.svelte');
		RichTextEditor = mod.default;
	});

	import * as v from 'valibot';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { useForm } from '$lib/utils/use-form.svelte';
	import { createCampaign, updateCampaign, deleteCampaign, updateCampaignStatus, previewCampaign, testCampaign } from '../campaigns.remote';
	import { listLists } from '../lists.remote';
	import { listTemplates } from '../../emails.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';
	import { campaignStatusVariant } from '$lib/utils/admin';

	import { untrack } from 'svelte';
	import type { ListmonkCampaign } from '$lib/server/listmonk';

	const {
		campaign = null,
		mode,
	}: {
		campaign?: ListmonkCampaign | null;
		mode: 'create' | 'edit';
	} = $props();

	let session = $derived(getSession().current);
	let listsQuery = $derived(listLists());
	let templatesQuery = $derived(listTemplates());

	let activeTab = $state('campaign');

	// ─── Form state (initialized from campaign prop) ─────────────
	const campaignSchema = v.object({
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required')),
		fromEmail: v.string(),
		listIds: v.pipe(v.array(v.string()), v.minLength(1, 'Select at least one list')),
		body: v.string(),
		contentType: v.picklist(['richtext', 'html', 'markdown', 'plain']),
		tags: v.array(v.string()),
		sendLater: v.boolean(),
		sendAt: v.string(),
		templateId: v.optional(v.number()),
	});

	// Capture campaign prop once — we don't want reactive updates resetting form state.
	const c = untrack(() => campaign);
	const initial = {
		name: c?.name ?? '',
		subject: c?.subject ?? '',
		fromEmail: c?.from_email ?? '',
		listIds: c?.lists.map((l: { id: number }) => String(l.id)) ?? [] as string[],
		body: c?.body ?? '',
		contentType: (c?.content_type ?? 'richtext') as 'richtext' | 'html' | 'markdown' | 'plain',
		tags: c ? [...c.tags] : [] as string[],
		sendLater: !!c?.send_at,
		sendAt: c?.send_at ? c.send_at.slice(0, 16) : '',
		templateId: c?.template_id,
	};

	const form = useForm(initial, campaignSchema);

	let savePending = $state(false);

	// ─── Preview & Test ──────────────────────────────────────────
	let previewOpen = $state(false);
	let previewHtml = $state('');
	let previewLoading = $state(false);
	let testOpen = $state(false);
	let testEmails = $state<string[]>([]);
	let testPending = $state(false);

	// ─── Confirm Dialogs ─────────────────────────────────────────
	let confirmDelete = $state(false);
	let confirmSend = $state(false);

	let isDraft = $derived(mode === 'create' || campaign?.status === 'draft');
	let canEdit = $derived(isDraft && can(session, 'campaign', 'edit'));

	async function handleSave() {
		if (!form.validate()) return;

		const { name, subject, fromEmail, listIds, body, contentType, templateId, tags, sendLater, sendAt } = form.values;
		savePending = true;
		try {
			if (mode === 'create') {
				const created = await createCampaign({
					name,
					subject,
					fromEmail: fromEmail || undefined,
					lists: listIds.map(Number),
					body,
					contentType,
					templateId,
					tags: tags.length ? tags : undefined,
					sendAt: sendLater && sendAt ? new Date(sendAt).toISOString() : undefined,
				});
				toast.success('Campaign created.');
				goto(`/admin/emails/campaigns/${created.id}`);
			} else if (campaign) {
				await updateCampaign({
					id: campaign.id,
					name,
					subject,
					fromEmail: fromEmail || undefined,
					lists: listIds.map(Number),
					body,
					contentType,
					templateId,
					tags,
					sendAt: sendLater && sendAt ? new Date(sendAt).toISOString() : null,
				});
				toast.success('Campaign saved.');
			}
		} catch (err) {
			toastError(err, 'Failed to save campaign.');
		} finally {
			savePending = false;
		}
	}

	async function handlePreview() {
		if (!campaign) return;
		previewLoading = true;
		previewOpen = true;
		try {
			previewHtml = await previewCampaign(campaign.id);
		} catch (err) {
			toastError(err, 'Failed to load preview.');
			previewOpen = false;
		} finally {
			previewLoading = false;
		}
	}

	async function handleTestSend() {
		if (!campaign) return;
		if (testEmails.length === 0) {
			toast.error('Enter at least one email address.');
			return;
		}
		testPending = true;
		try {
			await testCampaign({ id: campaign.id, subscribers: testEmails });
			toast.success(`Test email sent to ${testEmails.join(', ')}.`);
			testEmails = [];
		} catch (err) {
			toastError(err, 'Failed to send test email.');
		} finally {
			testPending = false;
		}
	}

	async function handleSendNow() {
		if (!campaign) return;
		try {
			await updateCampaignStatus({ id: campaign.id, status: 'running' });
			toast.success(`Campaign "${campaign.name}" started.`);
			goto('/admin/emails/campaigns');
		} catch (err) {
			toastError(err, 'Failed to start campaign.');
		}
	}

	async function handleDelete() {
		if (!campaign) return;
		try {
			await deleteCampaign(campaign.id);
			toast.success('Campaign deleted.');
			goto('/admin/emails/campaigns');
		} catch (err) {
			toastError(err, 'Failed to delete campaign.');
		}
	}


</script>

<Breadcrumb items={[
	{ label: 'Campaigns', href: '/admin/emails/campaigns' },
	{ label: mode === 'create' ? 'New Campaign' : form.values.name || 'Campaign' },
]} />

<div class="campaign-header">
	<div class="campaign-title">
		<h1>{mode === 'create' ? 'New Campaign' : form.values.name}</h1>
		{#if campaign}
			<Badge variant={campaignStatusVariant(campaign.status)}>{campaign.status}</Badge>
		{/if}
	</div>
	<div class="campaign-actions">
		{#if campaign && can(session, 'campaign', 'send')}
			<Button variant="ghost" onclick={() => (testOpen = true)}>Test</Button>
		{/if}
		{#if campaign && campaign.status === 'draft' && can(session, 'campaign', 'send')}
			<Button variant="primary" onclick={() => (confirmSend = true)}>Send Campaign</Button>
		{/if}
		{#if canEdit}
			<Button variant="primary" onclick={handleSave} disabled={savePending}>
				{savePending ? 'Saving...' : 'Save'}
			</Button>
		{/if}
		{#if campaign && campaign.status === 'draft' && can(session, 'campaign', 'delete')}
			<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
		{/if}
	</div>
</div>

<div class="campaign-body">
	<Card>
			<Tabs bind:value={activeTab} tabs={[{ value: 'campaign', label: 'Campaign' }, { value: 'content', label: 'Content' }]}>
				<TabContent value="campaign">
					<div class="form-fields">
						<FormField label="Name" required error={form.fieldError('name')}>
							<Input bind:value={form.values.name} onblur={() => form.touch('name')} placeholder="My Campaign" disabled={!canEdit} />
						</FormField>

						<FormField label="Subject" required error={form.fieldError('subject')}>
							<Input bind:value={form.values.subject} onblur={() => form.touch('subject')} placeholder="Email subject line" disabled={!canEdit} />
						</FormField>

						<FormField label="From Email" hint="Leave blank for default">
							<Input type="email" bind:value={form.values.fromEmail} placeholder="noreply@example.com" disabled={!canEdit} />
						</FormField>

						<FormField label="Lists" required error={form.fieldError('listIds')}>
							{@const allLists = listsQuery.current?.lists ?? []}
							<MultiSelect
								bind:selected={form.values.listIds}
								options={allLists.map((l) => ({ value: String(l.id), label: l.name, detail: l.type }))}
								placeholder="Search lists..."
								disabled={!canEdit}
							/>
						</FormField>

						<FormField label="Tags" hint="Press Enter to add">
							<TagInput bind:tags={form.values.tags} disabled={!canEdit} placeholder="Add a tag..." />
						</FormField>

						{#if canEdit}
							<div class="send-later">
								<label class="send-later-toggle">
									<input type="checkbox" bind:checked={form.values.sendLater} />
									<span>Schedule for later</span>
								</label>
								{#if form.values.sendLater}
									<DatePicker bind:value={form.values.sendAt} granularity="minute" />
								{/if}
							</div>
						{/if}
					</div>
				</TabContent>

				<TabContent value="content">
					<div class="form-fields">
						<div class="content-header-row">
							<FormField label="Content Type">
								<Select bind:value={form.values.contentType} disabled={!canEdit} options={[
									{ value: 'richtext', label: 'Rich Text' },
									{ value: 'html', label: 'Raw HTML' },
									{ value: 'markdown', label: 'Markdown' },
									{ value: 'plain', label: 'Plain Text' },
								]} />
							</FormField>

							<FormField label="Template">
								{@const templates = templatesQuery.current?.templates ?? []}
								{@const campaignTemplates = templates.filter((t) => t.type === 'campaign' || t.type === 'campaign_visual')}
								<Select
									value={form.values.templateId?.toString() ?? ''}
									onValueChange={(v) => { form.values.templateId = v ? Number(v) : undefined; }}
									disabled={!canEdit}
									options={[
										{ value: '', label: 'Default' },
										...campaignTemplates.map((tpl) => ({ value: String(tpl.id), label: tpl.name })),
									]}
								/>
							</FormField>

							{#if campaign}
								<div class="preview-btn-wrap">
									<Button variant="ghost" onclick={handlePreview}>Preview</Button>
								</div>
							{/if}
						</div>

						{#if form.values.contentType === 'richtext'}
							<FormField label="Body">
								{#if RichTextEditor}
									<RichTextEditor value={form.values.body} onchange={(html: string) => (form.values.body = html)} />
								{:else}
									<Spinner centered />
								{/if}
							</FormField>
						{:else}
							<FormField label="Body">
								<textarea class="textarea" bind:value={form.values.body} rows="16" placeholder="Email content..." disabled={!canEdit}></textarea>
							</FormField>
						{/if}

						<div class="template-vars">
							<span class="template-vars-label">Template variables:</span>
							<code>{'{{ .Subscriber.Name }}'}</code>
							<code>{'{{ .Subscriber.Email }}'}</code>
							<code>{'{{ .Subscriber.Attribs }}'}</code>
						</div>
					</div>
				</TabContent>
			</Tabs>
	</Card>

	{#if campaign && campaign.status !== 'draft'}
		<div class="stats-row">
			<div class="stat"><span class="stat-value">{campaign.sent}</span><span class="stat-label">Sent</span></div>
			<div class="stat"><span class="stat-value">{campaign.views}</span><span class="stat-label">Views</span></div>
			<div class="stat"><span class="stat-value">{campaign.clicks}</span><span class="stat-label">Clicks</span></div>
			<div class="stat"><span class="stat-value">{campaign.bounces}</span><span class="stat-label">Bounces</span></div>
		</div>
	{/if}
</div>

<!-- Confirm Dialogs -->
<ConfirmDialog
	bind:open={confirmSend}
	title="Send Campaign"
	description="Start sending &quot;{form.values.name}&quot; to all subscribers on the selected lists? This cannot be undone."
	confirmLabel="Yes, send now"
	variant="primary"
	onconfirm={handleSendNow}
/>

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Campaign"
	description="Permanently delete this campaign? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<!-- Test Send Dialog -->
<DialogShell bind:open={testOpen} title="Send Test Email" maxWidth="480px">
	<div class="form-fields">
		<FormField label="Recipients" hint="Press Enter to add. Must be existing subscribers.">
			<TagInput bind:tags={testEmails} placeholder="Add email..." />
		</FormField>
		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => (testOpen = false)}>Cancel</Button>
			<Button variant="primary" onclick={handleTestSend} disabled={testPending}>
				{testPending ? 'Sending...' : 'Send Test'}
			</Button>
		</div>
	</div>
</DialogShell>

<!-- Preview Dialog -->
<DialogShell bind:open={previewOpen} title="Campaign Preview" maxWidth="800px">
	{#if previewLoading}
		<Spinner size={32} centered />
	{:else}
		<iframe
			class="preview-frame"
			srcdoc={previewHtml}
			sandbox="allow-same-origin"
			title="Campaign preview"
		></iframe>
	{/if}
</DialogShell>

<style>
	.campaign-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.campaign-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.campaign-title h1 {
		margin: 0;
	}

	.campaign-actions {
		display: flex;
		gap: 0.5rem;
	}

	.campaign-body {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* ─── Form ────────────────────────────────────────────────────── */

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.content-header-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.content-header-row :global(label) {
		flex: 1;
	}

	.preview-btn-wrap {
		padding-bottom: 0.125rem;
	}

	.textarea {
		font-family: monospace;
	}

	.send-later {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.send-later-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.send-later-toggle input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	.template-vars {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
		font-size: 0.8rem;
	}

	.template-vars-label {
		color: var(--color-muted);
	}

	/* Make the rich text editor taller on campaign pages.
	   clamp: 250px floor (mobile), scales with viewport, 600px cap (desktop) */
	.form-fields :global(.rte-editor) {
		min-height: clamp(250px, 45vh, 600px);
	}

	/* Taller editor for campaign content — user can drag to resize */
	.form-fields :global(.rte-container) {
		resize: vertical;
		overflow: hidden;
		min-height: 350px;
	}

	.template-vars code {
		background: var(--color-hover);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--color-foreground);
	}

	/* ─── Stats row ───────────────────────────────────────────────── */

	.stats-row {
		display: flex;
		gap: 2rem;
		padding: 1rem 1.5rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	.stat {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-foreground);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	/* ─── Preview ─────────────────────────────────────────────────── */

	.preview-frame {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		width: 100%;
		min-height: 500px;
		height: 70vh;
		background: white;
	}

	@media (max-width: 768px) {
		.content-header-row {
			flex-direction: column;
			align-items: stretch;
		}

		.stats-row {
			flex-wrap: wrap;
			gap: 1rem;
		}
	}
</style>
