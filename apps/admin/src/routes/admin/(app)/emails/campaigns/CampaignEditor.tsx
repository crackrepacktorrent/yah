import { type Component, For, Show, batch, createMemo, createSignal, lazy, untrack } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createAsync } from '@solidjs/router';
import { toast } from 'solid-sonner';
import * as v from 'valibot';
import {
	Badge, Breadcrumb, Button, Card, AlertDialog, Dialog,
	FormField, Input, Select, Spinner, Tabs, TabContent, TagInput,
} from '~/components';
import { MultiSelect } from '~/components';
import { DatePicker } from '~/components';
import { requireSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { campaignStatusVariant, toastError } from '~/lib/utils';
import { createForm } from '~/lib/use-form';
import {
	createCampaign, updateCampaign, deleteCampaigns,
	updateCampaignStatus, previewCampaign, testCampaign,
} from '../campaigns.server';
import { listLists } from '../lists.server';
import { listTemplates } from '../emails.server';

// Lazy-load the RichTextEditor to keep the initial bundle small
const RichTextEditor = lazy(() =>
	import('~/components/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

// ─── Types ───────────────────────────────────────────────────────────────────

type CampaignList = { id: number; name: string };

export type ListmonkCampaign = {
	id: number;
	name: string;
	subject: string;
	from_email: string;
	status: string;
	body: string;
	content_type: string;
	template_id?: number;
	send_at: string | null;
	sent: number;
	views: number;
	clicks: number;
	bounces: number;
	lists: CampaignList[];
	tags: string[];
};

type CampaignEditorProps = {
	campaign?: ListmonkCampaign | null;
	mode: 'create' | 'edit';
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const CampaignSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty('Name is required.')),
	subject: v.pipe(v.string(), v.nonEmpty('Subject is required.')),
	fromEmail: v.string(),
	listIds: v.pipe(v.array(v.string()), v.minLength(1, 'Select at least one list.')),
	body: v.string(),
	contentType: v.picklist(['richtext', 'html', 'markdown', 'plain'] as const),
	templateId: v.string(),
	tags: v.array(v.string()),
	sendLater: v.boolean(),
	sendAt: v.string(),
});

export const CampaignEditor: Component<CampaignEditorProps> = (props) => {
	const navigate = useNavigate();
	const session = createAsync(() => requireSession());
	const listsQuery = createAsync(() => listLists());
	const templatesQuery = createAsync(() => listTemplates());

	// Capture initial campaign value without reactive tracking
	const c = untrack(() => props.campaign);

	// ─── Form ────────────────────────────────────────────────────────────────────

	const form = createForm(CampaignSchema, {
		name: c?.name ?? '',
		subject: c?.subject ?? '',
		fromEmail: c?.from_email ?? '',
		listIds: c?.lists.map((l) => String(l.id)) ?? [],
		body: c?.body ?? '',
		contentType: (c?.content_type as 'richtext' | 'html' | 'markdown' | 'plain') ?? 'richtext',
		templateId: c?.template_id ? String(c.template_id) : '',
		tags: c ? [...c.tags] : [],
		sendLater: !!c?.send_at,
		sendAt: c?.send_at ? c.send_at.slice(0, 16) : '',
	});

	// ─── UI state ────────────────────────────────────────────────────────────────

	const [activeTab, setActiveTab] = createSignal('campaign');
	const [savePending, setSavePending] = createSignal(false);

	const [previewOpen, setPreviewOpen] = createSignal(false);
	const [previewHtml, setPreviewHtml] = createSignal('');
	const [previewLoading, setPreviewLoading] = createSignal(false);

	const [testOpen, setTestOpen] = createSignal(false);
	const [testEmails, setTestEmails] = createSignal<string[]>([]);
	const [testPending, setTestPending] = createSignal(false);

	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmSend, setConfirmSend] = createSignal(false);

	const isDraft = createMemo(() => props.mode === 'create' || props.campaign?.status === 'draft');
	const canEdit = createMemo(() => isDraft() && can(session(), 'campaign', 'edit'));

	const campaignTemplates = createMemo(() =>
		(templatesQuery()?.templates ?? []).filter((t) => t.type === 'campaign' || t.type === 'campaign_visual'),
	);

	const listOptions = createMemo(() =>
		(listsQuery()?.lists ?? []).map((l: { id: number; name: string; type: string }) => ({
			value: String(l.id),
			label: l.name,
			detail: l.type,
		})),
	);

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	// eslint-disable-next-line solid/reactivity -- handleSubmit wraps this in a tracked scope
	const handleSave = form.handleSubmit(async (values) => {
		setSavePending(true);
		try {
			if (props.mode === 'create') {
				const created = await createCampaign({
					name: values.name,
					subject: values.subject,
					fromEmail: values.fromEmail || undefined,
					lists: values.listIds.map(Number),
					body: values.body,
					contentType: values.contentType,
					templateId: values.templateId ? Number(values.templateId) : undefined,
					tags: values.tags.length ? values.tags : undefined,
					sendAt: values.sendLater && values.sendAt ? new Date(values.sendAt).toISOString() : undefined,
				});
				toast.success('Campaign created.');
				navigate(`/admin/emails/campaigns/${created!.id}`);
			} else if (props.campaign) {
				await updateCampaign({
					id: props.campaign.id,
					name: values.name,
					subject: values.subject,
					fromEmail: values.fromEmail || undefined,
					lists: values.listIds.map(Number),
					body: values.body,
					contentType: values.contentType,
					templateId: values.templateId ? Number(values.templateId) : undefined,
					tags: values.tags,
					sendAt: values.sendLater && values.sendAt ? new Date(values.sendAt).toISOString() : null,
				});
				toast.success('Campaign saved.');
			}
		} catch (err) {
			toastError(err, 'Failed to save campaign.');
		} finally {
			setSavePending(false);
		}
	});

	async function handlePreview() {
		if (!props.campaign) return;
		batch(() => {
			setPreviewLoading(true);
			setPreviewOpen(true);
		});
		try {
			const html = await previewCampaign(props.campaign.id);
			setPreviewHtml(html);
		} catch (err) {
			toastError(err, 'Failed to load preview.');
			setPreviewOpen(false);
		} finally {
			setPreviewLoading(false);
		}
	}

	async function handleTestSend() {
		if (!props.campaign) return;
		if (testEmails().length === 0) {
			toast.error('Enter at least one email address.');
			return;
		}
		setTestPending(true);
		try {
			await testCampaign({ id: props.campaign.id, subscribers: testEmails() });
			toast.success(`Test email sent to ${testEmails().join(', ')}.`);
			setTestEmails([]);
		} catch (err) {
			toastError(err, 'Failed to send test email.');
		} finally {
			setTestPending(false);
		}
	}

	async function handleSendNow() {
		if (!props.campaign) return;
		try {
			await updateCampaignStatus({ id: props.campaign.id, status: 'running' });
			toast.success(`Campaign "${props.campaign.name}" started.`);
			navigate('/admin/emails/campaigns');
		} catch (err) {
			toastError(err, 'Failed to start campaign.');
		}
	}

	async function handleDelete() {
		if (!props.campaign) return;
		try {
			await deleteCampaigns([props.campaign.id]);
			toast.success('Campaign deleted.');
			navigate('/admin/emails/campaigns');
		} catch (err) {
			toastError(err, 'Failed to delete campaign.');
		}
	}

	return (
		<>
			<Breadcrumb items={[
				{ label: 'Campaigns', href: '/admin/emails/campaigns' },
				{ label: props.mode === 'create' ? 'New Campaign' : form.values.name || 'Campaign' },
			]} />

			<div class="campaign-header">
				<div class="campaign-title">
					<h1>{props.mode === 'create' ? 'New Campaign' : form.values.name}</h1>
					<Show when={props.campaign}>
						{(c) => <Badge variant={campaignStatusVariant(c().status)}>{c().status}</Badge>}
					</Show>
				</div>
				<div class="campaign-actions">
					<Show when={props.campaign && can(session(), 'campaign', 'send')}>
						<Button variant="ghost" onClick={() => setTestOpen(true)}>Test</Button>
					</Show>
					<Show when={props.campaign && props.campaign.status === 'draft' && can(session(), 'campaign', 'send')}>
						<Button onClick={() => setConfirmSend(true)}>Send Campaign</Button>
					</Show>
					<Show when={canEdit()}>
						<Button onClick={handleSave} disabled={savePending()}>
							{savePending() ? 'Saving…' : 'Save'}
						</Button>
					</Show>
					<Show when={props.campaign && props.campaign.status === 'draft' && can(session(), 'campaign', 'delete')}>
						<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
					</Show>
				</div>
			</div>

			<div class="campaign-body">
				<Card>
					<Tabs
						value={activeTab()}
						onChange={setActiveTab}
						tabs={[{ value: 'campaign', label: 'Campaign' }, { value: 'content', label: 'Content' }]}
					>
						<TabContent value="campaign">
							<div class="form-fields">
								<FormField label="Name" required error={canEdit() ? form.fieldError('name') : undefined}>
									<Input
										placeholder="My Campaign"
										{...form.field('name')}
										disabled={!canEdit()}
									/>
								</FormField>

								<FormField label="Subject" required error={canEdit() ? form.fieldError('subject') : undefined}>
									<Input
										placeholder="Email subject line"
										{...form.field('subject')}
										disabled={!canEdit()}
									/>
								</FormField>

								<FormField label="From Email" hint="Leave blank for default">
									<Input
										type="email"
										placeholder="noreply@example.com"
										{...form.field('fromEmail')}
										disabled={!canEdit()}
									/>
								</FormField>

								<FormField label="Lists" required error={canEdit() ? form.fieldError('listIds') : undefined}>
									<MultiSelect
										selected={form.values.listIds}
										onChange={(v) => form.setValue('listIds', v)}
										options={listOptions()}
										placeholder="Search lists…"
										disabled={!canEdit()}
									/>
								</FormField>

								<FormField label="Tags" hint="Press Enter to add">
									<TagInput
										tags={form.values.tags}
										onChange={(v) => form.setValue('tags', v)}
										placeholder="Add a tag…"
										disabled={!canEdit()}
									/>
								</FormField>

								<Show when={canEdit()}>
									<div class="send-later">
										<label class="send-later-toggle">
											<input
												type="checkbox"
												checked={form.values.sendLater}
												onChange={(e) => form.setValue('sendLater', e.currentTarget.checked)}
											/>
											<span>Schedule for later</span>
										</label>
										<Show when={form.values.sendLater}>
											<DatePicker
												value={form.values.sendAt}
												onChange={(v) => form.setValue('sendAt', v)}
												granularity="minute"
											/>
										</Show>
									</div>
								</Show>
							</div>
						</TabContent>

						<TabContent value="content">
							<div class="form-fields">
								<div class="content-header-row">
									<FormField label="Content Type">
										<Select
											value={form.values.contentType}
											onValueChange={(v) => form.setValue('contentType', v as 'richtext' | 'html' | 'markdown' | 'plain')}
											disabled={!canEdit()}
											options={[
												{ value: 'richtext', label: 'Rich Text' },
												{ value: 'html', label: 'Raw HTML' },
												{ value: 'markdown', label: 'Markdown' },
												{ value: 'plain', label: 'Plain Text' },
											]}
										/>
									</FormField>

									<FormField label="Template">
										<Select
											value={form.values.templateId}
											onValueChange={(v) => form.setValue('templateId', v)}
											disabled={!canEdit()}
											options={[
												{ value: '', label: 'Default' },
												...campaignTemplates().map((t) => ({ value: String(t.id), label: t.name })),
											]}
										/>
									</FormField>

									<Show when={props.campaign}>
										<div class="preview-btn-wrap">
											<Button variant="ghost" onClick={handlePreview}>Preview</Button>
										</div>
									</Show>
								</div>

								<Show
									when={form.values.contentType === 'richtext'}
									fallback={
										<FormField label="Body">
											<textarea
												class="textarea campaign-textarea"
												rows={16}
												value={form.values.body}
												onInput={(e) => form.setValue('body', e.currentTarget.value)}
												disabled={!canEdit()}
												placeholder="Email content…"
											/>
										</FormField>
									}
								>
									<FormField label="Body">
										<RichTextEditor
											value={form.values.body}
											onChange={(v) => form.setValue('body', v)}
											disabled={!canEdit()}
										/>
									</FormField>
								</Show>

								<div class="template-vars">
									<span class="template-vars-label">Template variables:</span>
									<For each={['{{ .Subscriber.Name }}', '{{ .Subscriber.Email }}', '{{ .Subscriber.Attribs }}']}>
										{(v) => <code class="template-var">{v}</code>}
									</For>
								</div>
							</div>
						</TabContent>
					</Tabs>
				</Card>

				<Show when={props.campaign && props.campaign.status !== 'draft'}>
					<div class="stats-row">
						<div class="stat"><span class="stat-value">{props.campaign!.sent}</span><span class="stat-label">Sent</span></div>
						<div class="stat"><span class="stat-value">{props.campaign!.views}</span><span class="stat-label">Views</span></div>
						<div class="stat"><span class="stat-value">{props.campaign!.clicks}</span><span class="stat-label">Clicks</span></div>
						<div class="stat"><span class="stat-value">{props.campaign!.bounces}</span><span class="stat-label">Bounces</span></div>
					</div>
				</Show>
			</div>

			{/* Confirm dialogs */}
			<AlertDialog
				open={confirmSend()}
				onOpenChange={setConfirmSend}
				title="Send Campaign"
				description={`Start sending "${form.values.name}" to all subscribers on the selected lists? This cannot be undone.`}
				confirmLabel="Yes, send now"
				variant="primary"
				onconfirm={handleSendNow}
			/>

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title="Delete Campaign"
				description="Permanently delete this campaign? This cannot be undone."
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			{/* Test send dialog */}
			<Dialog
				open={testOpen()}
				onOpenChange={setTestOpen}
				title="Send Test Email"
				maxWidth="480px"
				footer={<>
					<Button variant="ghost" onClick={() => setTestOpen(false)}>Cancel</Button>
					<Button onClick={handleTestSend} disabled={testPending()}>
						{testPending() ? 'Sending…' : 'Send Test'}
					</Button>
				</>}
			>
				<div class="form-fields">
					<FormField label="Recipients" hint="Press Enter to add. Must be existing subscribers.">
						<TagInput tags={testEmails()} onChange={setTestEmails} placeholder="Add email…" />
					</FormField>
				</div>
			</Dialog>

			{/* Preview dialog */}
			<Dialog open={previewOpen()} onOpenChange={setPreviewOpen} title="Campaign Preview" maxWidth="800px">
				<Show
					when={!previewLoading()}
					fallback={<Spinner size={32} centered />}
				>
					<iframe
						class="preview-frame"
						srcdoc={previewHtml()}
						sandbox=""
						title="Campaign preview"
					/>
				</Show>
			</Dialog>
		</>
	);
};
