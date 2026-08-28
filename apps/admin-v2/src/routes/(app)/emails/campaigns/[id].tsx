import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import type { CampaignDetail, CampaignTransition } from '~/features/campaigns/contracts';
import { CampaignForm, type CampaignFormValues } from '~/features/campaigns/form';
import { campaignStatusLabel, campaignTypeLabel } from '~/features/campaigns/presentation';
import { decodeCampaignRouteId } from '~/features/campaigns/routing';
import { deleteCampaigns, getCampaign, listCampaigns, previewCampaign, transitionCampaign, updateCampaign } from '~/features/campaigns/server';
import { listEmailTemplates } from '~/features/email-templates/server';
import { listMailingLists } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/campaigns/:id', {
	matchFilters: { id: (segment) => decodeCampaignRouteId(segment) > 0 },
	preload: ({ params }) => void getCampaign(decodeCampaignRouteId(params.id)),
});

function escapePlainPreview(value: string): string {
	return `<pre style="white-space:pre-wrap;font:inherit">${value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`;
}

function transitionCopy(campaign: CampaignDetail, transition: CampaignTransition): { title: string; description: string; label: string } {
	switch (transition) {
		case 'schedule': return { title: 'Schedule campaign?', description: `Queue ${campaign.name} for ${new Date(campaign.sendAt!).toLocaleString()}?`, label: 'Schedule campaign' };
		case 'unschedule': return { title: 'Return campaign to draft?', description: `${campaign.name} will no longer send at its scheduled time.`, label: 'Return to draft' };
		case 'start': return { title: 'Send campaign now?', description: `Start sending ${campaign.name} to eligible subscribers on its selected lists? Sending cannot be undone.`, label: 'Send now' };
		case 'pause': return { title: 'Pause campaign?', description: `Stop queueing new deliveries for ${campaign.name}? Messages already queued may still be delivered.`, label: 'Pause campaign' };
		case 'resume': return { title: 'Resume campaign?', description: `Resume queueing deliveries for ${campaign.name}?`, label: 'Resume campaign' };
		case 'cancel': return { title: 'Cancel campaign?', description: `Permanently cancel ${campaign.name}? It cannot be resumed, and messages already queued may still be delivered.`, label: 'Cancel campaign' };
	}
}

export default function CampaignDetailPage(props: RouteProps<typeof route>) {
	const campaignId = createMemo(() => decodeCampaignRouteId(props.params.id));
	return <Show when={campaignId()} keyed>{(resolved) => <CampaignRoute campaignId={resolved} />}</Show>;
}

function CampaignRoute(props: { campaignId: number }) {
	const campaign = createMemo(() => getCampaign(props.campaignId));
	return <Show when={campaign()}>{(resolved) => <CampaignDetailView campaign={resolved()} />}</Show>;
}

function CampaignDetailView(props: { campaign: CampaignDetail }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(
		() =>
			props.campaign.status === 'draft' &&
			props.campaign.contentType !== 'visual' &&
			(session().permissions['campaign']?.includes('edit') ?? false) &&
			(session().permissions['list']?.includes('view') ?? false),
	);
	const canDelete = createMemo(() => props.campaign.status === 'draft' && (session().permissions['campaign']?.includes('delete') ?? false));
	const canSend = createMemo(() => session().permissions['campaign']?.includes('send') ?? false);
	const canViewTemplates = createMemo(() => session().permissions['template']?.includes('view') ?? false);
	const lists = createMemo(() => canEdit() ? listMailingLists() : []);
	const templates = createMemo(() => canEdit() && canViewTemplates() ? listEmailTemplates() : []);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const [deletePending, setDeletePending] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal('');
	const [transitionOpen, setTransitionOpen] = createSignal(false);
	const [selectedTransition, setSelectedTransition] = createSignal<CampaignTransition>('start');
	const [transitionPending, setTransitionPending] = createSignal(false);
	const [transitionError, setTransitionError] = createSignal('');
	const [previewPending, setPreviewPending] = createSignal(false);
	const [previewDocument, setPreviewDocument] = createSignal('');
	const [previewError, setPreviewError] = createSignal('');
	let previewGeneration = 0;
	function clearPreview(): void {
		previewGeneration += 1;
		setPreviewPending(false);
		setPreviewDocument('');
		setPreviewError('');
	}

	const formInitial = createMemo<CampaignFormValues>(() => ({
		type: props.campaign.type,
		name: props.campaign.name,
		subject: props.campaign.subject,
		fromEmail: props.campaign.fromEmail,
		listIds: props.campaign.lists.map((list) => list.id).filter((id) => id > 0),
		body: props.campaign.body,
		contentType: props.campaign.contentType === 'visual' ? 'html' : props.campaign.contentType,
		templateId: props.campaign.templateId,
		tags: props.campaign.tags,
		sendAt: props.campaign.sendAt,
	}));

	async function refresh(): Promise<void> {
		revalidate([
			getCampaign.keyFor(props.campaign.id),
			listCampaigns.key,
			previewCampaign.keyFor(props.campaign.id),
		]);
		await getCampaign(props.campaign.id);
	}

	async function handleUpdate(values: CampaignFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			await updateCampaign({
				id: props.campaign.id,
				expectedUpdatedAt: props.campaign.updatedAt,
				name: values.name,
				subject: values.subject,
				fromEmail: values.fromEmail,
				listIds: values.listIds,
				body: values.body,
				contentType: values.contentType,
				templateId: values.templateId,
				tags: values.tags,
				sendAt: values.sendAt,
			});
			clearPreview();
			try {
				await refresh();
			} catch {
				setError('The campaign draft was saved, but its latest provider state could not be reloaded. Reload this page before editing again.');
				return;
			}
			toast.success('Campaign draft updated.');
		} catch (caught) {
			setError(visibleError(caught, 'The campaign draft could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	async function handleDelete(): Promise<void> {
		setDeletePending(true);
		setDeleteError('');
		try {
			await deleteCampaigns({ campaigns: [{ id: props.campaign.id, expectedUpdatedAt: props.campaign.updatedAt }] });
			revalidate(listCampaigns.key);
			setDeleteOpen(false);
			toast.success('Campaign draft deleted.');
			navigate('/emails/campaigns');
		} catch (caught) {
			setDeleteError(visibleError(caught, 'The campaign draft could not be deleted.'));
		} finally {
			setDeletePending(false);
		}
	}

	function requestTransition(transition: CampaignTransition): void {
		setSelectedTransition(transition);
		setTransitionError('');
		setTransitionOpen(true);
	}

	async function handleTransition(): Promise<void> {
		setTransitionPending(true);
		setTransitionError('');
		try {
			await transitionCampaign({ id: props.campaign.id, expectedUpdatedAt: props.campaign.updatedAt, transition: selectedTransition() });
			try {
				await refresh();
			} catch {
				setTransitionOpen(false);
				toast.error('The campaign status changed, but its latest provider state could not be reloaded. Reload this page before another change.');
				return;
			}
			setTransitionOpen(false);
			toast.success('Campaign status updated.');
		} catch (caught) {
			setTransitionError(visibleError(caught, 'The campaign status could not be changed.'));
		} finally {
			setTransitionPending(false);
		}
	}

	async function loadPreview(): Promise<void> {
		const generation = ++previewGeneration;
		setPreviewPending(true);
		setPreviewError('');
		try {
			const document = await previewCampaign(props.campaign.id);
			if (generation === previewGeneration) {
				setPreviewDocument(props.campaign.contentType === 'plain' ? escapePlainPreview(document) : document);
			}
		} catch (caught) {
			if (generation === previewGeneration) setPreviewError(visibleError(caught, 'The saved campaign preview could not be rendered.'));
		} finally {
			if (generation === previewGeneration) setPreviewPending(false);
		}
	}

	const transition = createMemo(() => transitionCopy(props.campaign, selectedTransition()));

	return (
		<section class="campaigns-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/emails/campaigns">Campaigns</a><span aria-hidden="true">/</span><span>{props.campaign.name}</span></nav>
			<header class="page-header">
				<div><h1>{props.campaign.name}</h1><p>{campaignTypeLabel(props.campaign.type)} · <span class={`campaign-status campaign-status--${props.campaign.status}`}>{campaignStatusLabel(props.campaign.status)}</span></p></div>
				<div class="campaign-detail-actions">
					<button class="button button--secondary" type="button" onClick={() => void loadPreview()} disabled={previewPending()}>{previewPending() ? 'Rendering…' : 'Preview saved campaign'}</button>
					<Show when={canSend() && props.campaign.status === 'draft' && props.campaign.sendAt === null}><button class="button" type="button" onClick={() => requestTransition('start')}>Send now</button></Show>
					<Show when={canSend() && props.campaign.status === 'draft' && props.campaign.sendAt !== null}><button class="button" type="button" onClick={() => requestTransition('schedule')}>Schedule</button></Show>
					<Show when={canSend() && props.campaign.status === 'scheduled'}><button class="button button--secondary" type="button" onClick={() => requestTransition('unschedule')}>Return to draft</button></Show>
					<Show when={canSend() && props.campaign.status === 'running'}><button class="button button--secondary" type="button" onClick={() => requestTransition('pause')}>Pause</button><button class="button button--danger-secondary" type="button" onClick={() => requestTransition('cancel')}>Cancel</button></Show>
					<Show when={canSend() && props.campaign.status === 'paused'}><button class="button" type="button" onClick={() => requestTransition('resume')}>Resume</button><button class="button button--danger-secondary" type="button" onClick={() => requestTransition('cancel')}>Cancel</button></Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete</button></Show>
				</div>
			</header>
			<Show when={error()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<Show when={previewError()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
				<Show when={previewDocument()}>{(document) => <div class="campaign-preview"><div class="campaign-preview-header"><h2>Saved preview</h2><button class="button button--secondary" type="button" onClick={clearPreview}>Close preview</button></div><iframe srcdoc={document()} sandbox="" referrerpolicy="no-referrer" title="Rendered saved campaign preview" /></div>}</Show>

			<Show when={canEdit()} fallback={<ReadOnlyCampaign campaign={props.campaign} />}>
				<CampaignForm mode="edit" initial={formInitial()} lists={lists()} templates={templates()} pending={pending()} error="" cancelHref="/emails/campaigns" onSubmit={(values) => void handleUpdate(values)} />
			</Show>

			<ConfirmDialog open={deleteOpen()} title="Delete campaign draft?" description={`Permanently delete ${props.campaign.name}? This cannot be undone.`} confirmLabel="Delete campaign" pending={deletePending()} error={deleteError()} onConfirm={() => void handleDelete()} onOpenChange={setDeleteOpen} />
			<ConfirmDialog open={transitionOpen()} title={transition().title} description={transition().description} confirmLabel={transition().label} pending={transitionPending()} error={transitionError()} onConfirm={() => void handleTransition()} onOpenChange={setTransitionOpen} />
		</section>
	);
}

function ReadOnlyCampaign(props: { campaign: CampaignDetail }) {
	return (
		<>
			<Show when={props.campaign.contentType === 'visual'}><p class="campaign-note">Visual campaign content is read-only here. Its builder source must be edited with Listmonk’s compatible visual editor.</p></Show>
			<Show when={props.campaign.type === 'optin'}><p class="campaign-note">Listmonk owns this confirmation message and its opt-in URL.</p></Show>
			<dl class="campaign-metadata">
				<div><dt>From</dt><dd>{props.campaign.fromEmail}</dd></div><div><dt>Subject</dt><dd>{props.campaign.subject}</dd></div>
				<div><dt>Content</dt><dd>{props.campaign.contentType}</dd></div><div><dt>Template</dt><dd>{props.campaign.templateId ?? 'Default'}</dd></div>
				<div><dt>Scheduled</dt><dd>{props.campaign.sendAt ? new Date(props.campaign.sendAt).toLocaleString() : 'Not scheduled'}</dd></div><div><dt>Started</dt><dd>{props.campaign.startedAt ? new Date(props.campaign.startedAt).toLocaleString() : 'Not started'}</dd></div>
				<div><dt>Lists</dt><dd><For each={props.campaign.lists}>{(list) => <span class="campaign-inline-item">{list.name}</span>}</For></dd></div><div><dt>Tags</dt><dd><Show when={props.campaign.tags.length > 0} fallback="None"><For each={props.campaign.tags}>{(tag) => <span class="campaign-inline-item">{tag}</span>}</For></Show></dd></div>
			</dl>
			<div class="campaign-stats" aria-label="Campaign delivery statistics"><div><strong>{props.campaign.sent.toLocaleString()}</strong><span>Sent</span></div><div><strong>{props.campaign.views.toLocaleString()}</strong><span>Views</span></div><div><strong>{props.campaign.clicks.toLocaleString()}</strong><span>Clicks</span></div><div><strong>{props.campaign.bounces.toLocaleString()}</strong><span>Bounces</span></div></div>
			<div class="campaign-source"><h2>Saved content</h2><pre><code>{props.campaign.body}</code></pre></div>
		</>
	);
}
