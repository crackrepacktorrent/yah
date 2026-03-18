<script lang="ts">
	import { goto } from '$app/navigation';
	import { Badge, Breadcrumb, Button, Card, ConfirmDialog, FormField, Input, Section, Spinner, Tabs, TabContent, DialogShell, Select, DatePicker } from '$lib/components/admin';
	import { onMount } from 'svelte';

	let RichTextEditor: any = $state(null);
	onMount(async () => {
		const mod = await import('$lib/components/admin/RichTextEditor.svelte');
		RichTextEditor = mod.default;
	});

	import { toast } from 'svelte-sonner';
	import { createCampaign, updateCampaign, deleteCampaign, updateCampaignStatus, previewCampaign, testCampaign } from '../campaigns.remote';
	import { listLists } from '../lists.remote';
	import { listTemplates } from '../../emails.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	import type { ListmonkCampaign } from '$lib/server/listmonk';

	let {
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

	// ─── Form state ──────────────────────────────────────────────
	let name = $state('');
	let subject = $state('');
	let fromEmail = $state('');
	let listIds = $state<number[]>([]);
	let body = $state('');
	let contentType = $state<'richtext' | 'html' | 'markdown' | 'plain'>('richtext');
	let templateId = $state<number | undefined>(undefined);
	let tags = $state('');
	let sendLater = $state(false);
	let sendAt = $state('');

	let savePending = $state(false);

	// ─── Preview & Test ──────────────────────────────────────────
	let previewOpen = $state(false);
	let previewHtml = $state('');
	let previewLoading = $state(false);
	let testEmails = $state('');
	let testPending = $state(false);

	// ─── Confirm Dialogs ─────────────────────────────────────────
	let confirmDelete = $state(false);
	let confirmSend = $state(false);

	// ─── Init from campaign ──────────────────────────────────────
	$effect(() => {
		if (campaign) {
			name = campaign.name;
			subject = campaign.subject;
			fromEmail = campaign.from_email;
			listIds = campaign.lists.map((l) => l.id);
			body = campaign.body;
			contentType = campaign.content_type;
			templateId = campaign.template_id;
			tags = campaign.tags.join(', ');
			sendLater = !!campaign.send_at;
			sendAt = campaign.send_at ? campaign.send_at.slice(0, 16) : '';
		}
	});

	let isDraft = $derived(mode === 'create' || campaign?.status === 'draft');
	let canEdit = $derived(isDraft && can(session, 'campaign', 'edit'));

	async function handleSave() {
		savePending = true;
		try {
			const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
			if (mode === 'create') {
				const created = await createCampaign({
					name,
					subject,
					fromEmail: fromEmail || undefined,
					lists: listIds,
					body,
					contentType,
					templateId,
					tags: tagList.length ? tagList : undefined,
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
					lists: listIds,
					body,
					contentType,
					templateId,
					tags: tagList,
					sendAt: sendLater && sendAt ? new Date(sendAt).toISOString() : null,
				});
				toast.success('Campaign saved.');
			}
		} catch (err: any) {
			toast.error(err?.message || 'Failed to save campaign.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to load preview.');
			previewOpen = false;
		} finally {
			previewLoading = false;
		}
	}

	async function handleTestSend() {
		if (!campaign) return;
		const emails = testEmails.split(',').map((e) => e.trim()).filter(Boolean);
		if (emails.length === 0) {
			toast.error('Enter at least one email address.');
			return;
		}
		testPending = true;
		try {
			await testCampaign({ id: campaign.id, subscribers: emails });
			toast.success(`Test email sent to ${emails.join(', ')}.`);
			testEmails = '';
		} catch (err: any) {
			toast.error(err?.message || 'Failed to send test email.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to start campaign.');
		}
	}

	async function handleDelete() {
		if (!campaign) return;
		try {
			await deleteCampaign(campaign.id);
			toast.success('Campaign deleted.');
			goto('/admin/emails/campaigns');
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete campaign.');
		}
	}

	function toggleListId(id: number) {
		listIds = listIds.includes(id) ? listIds.filter((x) => x !== id) : [...listIds, id];
	}

	function statusVariant(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
		switch (status) {
			case 'draft': return 'default';
			case 'running': return 'success';
			case 'paused': return 'warning';
			case 'finished': return 'info';
			case 'cancelled': return 'error';
			case 'scheduled': return 'warning';
			default: return 'default';
		}
	}
</script>

<Breadcrumb items={[
	{ label: 'Campaigns', href: '/admin/emails/campaigns' },
	{ label: mode === 'create' ? 'New Campaign' : name || 'Campaign' },
]} />

<div class="campaign-header">
	<div class="campaign-title">
		<h1>{mode === 'create' ? 'New Campaign' : name}</h1>
		{#if campaign}
			<Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
		{/if}
	</div>
	<div class="campaign-actions">
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
	<div class="campaign-main">
		<Card>
			<Tabs bind:value={activeTab} tabs={[{ value: 'campaign', label: 'Campaign' }, { value: 'content', label: 'Content' }]}>
				<TabContent value="campaign">
					<div class="form-fields">
						<FormField label="Name" required>
							<Input bind:value={name} required placeholder="My Campaign" disabled={!canEdit} />
						</FormField>

						<FormField label="Subject" required>
							<Input bind:value={subject} required placeholder="Email subject line" disabled={!canEdit} />
						</FormField>

						<FormField label="From Email" hint="Leave blank for default">
							<Input type="email" bind:value={fromEmail} placeholder="noreply@example.com" disabled={!canEdit} />
						</FormField>

						<FormField label="Lists" required>
							{@const allLists = listsQuery.current?.lists ?? []}
							<div class="list-checkboxes">
								{#each allLists as list}
									<label class="list-checkbox">
										<input
											type="checkbox"
											checked={listIds.includes(list.id)}
											onchange={() => toggleListId(list.id)}
											disabled={!canEdit}
										/>
										<span>{list.name}</span>
										<Badge variant={list.type === 'public' ? 'info' : 'default'}>{list.type}</Badge>
									</label>
								{/each}
								{#if allLists.length === 0}
									<span class="cell-muted">No lists available</span>
								{/if}
							</div>
						</FormField>

						<FormField label="Tags" hint="Comma-separated">
							<Input bind:value={tags} placeholder="newsletter, announcement" disabled={!canEdit} />
						</FormField>

						{#if canEdit}
							<div class="send-later">
								<label class="send-later-toggle">
									<input type="checkbox" bind:checked={sendLater} />
									<span>Schedule for later</span>
								</label>
								{#if sendLater}
									<DatePicker bind:value={sendAt} granularity="minute" />
								{/if}
							</div>
						{/if}
					</div>
				</TabContent>

				<TabContent value="content">
					<div class="form-fields">
						<div class="content-header-row">
							<FormField label="Content Type">
								<Select bind:value={contentType} disabled={!canEdit} options={[
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
									value={templateId?.toString() ?? ''}
									onValueChange={(v) => { templateId = v ? Number(v) : undefined; }}
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

						{#if contentType === 'richtext'}
							<FormField label="Body">
								{#if RichTextEditor}
									<RichTextEditor value={body} onchange={(html: string) => (body = html)} />
								{:else}
									<Spinner centered />
								{/if}
							</FormField>
						{:else}
							<FormField label="Body">
								<textarea class="textarea" bind:value={body} rows="16" placeholder="Email content..." disabled={!canEdit}></textarea>
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
	</div>

	{#if campaign && can(session, 'campaign', 'send')}
		<div class="campaign-sidebar">
			<Card>
				<Section title="Send test">
					<div class="test-send-row">
						<Input bind:value={testEmails} placeholder="email1@example.com, email2@..." />
						<Button variant="secondary" onclick={handleTestSend} disabled={testPending}>
							{testPending ? 'Sending...' : 'Send'}
						</Button>
					</div>
					<span class="test-send-hint">Comma-separated. Must be existing subscribers.</span>
				</Section>
			</Card>

			{#if campaign.status !== 'draft'}
				<Card>
					<Section title="Stats">
						<div class="stat-grid">
							<div class="stat"><span class="stat-value">{campaign.sent}</span><span class="stat-label">Sent</span></div>
							<div class="stat"><span class="stat-value">{campaign.views}</span><span class="stat-label">Views</span></div>
							<div class="stat"><span class="stat-value">{campaign.clicks}</span><span class="stat-label">Clicks</span></div>
							<div class="stat"><span class="stat-value">{campaign.bounces}</span><span class="stat-label">Bounces</span></div>
						</div>
					</Section>
				</Card>
			{/if}
		</div>
	{/if}
</div>

<!-- Confirm Dialogs -->
<ConfirmDialog
	bind:open={confirmSend}
	title="Send Campaign"
	description="Start sending &quot;{name}&quot; to all subscribers on the selected lists? This cannot be undone."
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

<!-- Preview Dialog -->
<DialogShell bind:open={previewOpen} title="Campaign Preview" maxWidth="800px">
	{#if previewLoading}
		<Spinner size={32} centered />
	{:else}
		<div class="preview-frame">
			{@html previewHtml}
		</div>
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
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: 1.5rem;
		align-items: start;
	}

	.campaign-main {
		min-width: 0;
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

	.template-vars code {
		background: var(--color-hover);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--color-foreground);
	}

	/* ─── Sidebar ─────────────────────────────────────────────────── */

	.test-send-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.test-send-hint {
		display: block;
		font-size: 0.75rem;
		color: var(--color-muted);
		margin-top: 0.25rem;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-foreground);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	/* ─── Preview ─────────────────────────────────────────────────── */

	.preview-frame {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		min-height: 300px;
		max-height: 70vh;
		overflow-y: auto;
		background: white;
	}

	.preview-frame :global(*) {
		max-width: 100%;
	}

	@media (max-width: 768px) {
		.campaign-body {
			grid-template-columns: 1fr;
		}

		.content-header-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
