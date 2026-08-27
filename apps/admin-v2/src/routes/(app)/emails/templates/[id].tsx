import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { EmailTemplateDetail } from '~/features/email-templates/contracts';
import { EmailTemplateForm, emailTemplateKindLabel, type EmailTemplateFormValues } from '~/features/email-templates/form';
import { decodeEmailTemplateRouteId } from '~/features/email-templates/routing';
import {
	deleteEmailTemplate,
	getEmailTemplate,
	listEmailTemplates,
	previewEditedEmailTemplate,
	previewSavedEmailTemplate,
	setDefaultEmailTemplate,
	updateEmailTemplate,
} from '~/features/email-templates/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/templates/:id', {
	preload: ({ params }) => void getEmailTemplate(decodeEmailTemplateRouteId(params.id)),
});

export default function EmailTemplateDetailPage(props: RouteProps<typeof route>) {
	const template = createMemo(() => getEmailTemplate(decodeEmailTemplateRouteId(props.params.id)));
	return <Show when={template()}>{(resolved) => <EmailTemplateDetailView template={resolved()} />}</Show>;
}

function EmailTemplateDetailView(props: { template: EmailTemplateDetail }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(
		() => (session().permissions['template']?.includes('edit') ?? false) && props.template.kind !== 'campaign_visual',
	);
	const canDelete = createMemo(
		() => (session().permissions['template']?.includes('delete') ?? false) && !props.template.isDefault,
	);
	const canSetDefault = createMemo(
		() =>
			(session().permissions['template']?.includes('set-default') ?? false) &&
			props.template.kind === 'campaign' &&
			!props.template.isDefault,
	);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const [deletePending, setDeletePending] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal('');
	const [defaultPending, setDefaultPending] = createSignal(false);

	async function handleUpdate(values: EmailTemplateFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			await updateEmailTemplate({ id: props.template.id, name: values.name, subject: values.subject, body: values.body });
			revalidate([getEmailTemplate.keyFor(props.template.id), listEmailTemplates.key]);
			toast.success('Email template updated.');
		} catch (caught) {
			setError(visibleError(caught, 'The email template could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	async function handleSetDefault(): Promise<void> {
		setError('');
		setDefaultPending(true);
		try {
			await setDefaultEmailTemplate(props.template.id);
			revalidate([getEmailTemplate.keyFor(props.template.id), listEmailTemplates.key]);
			toast.success('Default campaign template updated.');
		} catch (caught) {
			setError(visibleError(caught, 'The default template could not be changed.'));
		} finally {
			setDefaultPending(false);
		}
	}

	async function handleDelete(): Promise<void> {
		setDeletePending(true);
		setDeleteError('');
		try {
			await deleteEmailTemplate(props.template.id);
			revalidate(listEmailTemplates.key);
			setDeleteOpen(false);
			toast.success('Email template deleted.');
			navigate('/emails');
		} catch (caught) {
			setDeleteError(visibleError(caught, 'The email template could not be deleted.'));
		} finally {
			setDeletePending(false);
		}
	}

	return (
		<section class="email-templates-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/emails">Email templates</a><span aria-hidden="true">/</span><span>{props.template.name}</span></nav>
			<header class="page-header">
				<div>
					<h1>{props.template.name}</h1>
					<p>{emailTemplateKindLabel(props.template.kind)}{props.template.isDefault ? ' · Default campaign template' : ''}</p>
				</div>
				<div class="template-detail-actions">
					<Show when={canSetDefault()}>
						<button class="button button--secondary" type="button" onClick={() => void handleSetDefault()} disabled={defaultPending()}>
							{defaultPending() ? 'Updating…' : 'Set as default'}
						</button>
					</Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete</button></Show>
				</div>
			</header>
			<Show when={error()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>

			<Show
				when={canEdit()}
				fallback={<ReadOnlyEmailTemplate template={props.template} />}
			>
				<EmailTemplateForm
					mode="edit"
					initial={{
						name: props.template.name,
						kind: props.template.kind === 'campaign' ? 'campaign' : 'tx',
						subject: props.template.subject,
						body: props.template.body,
					}}
					pending={pending()}
					error=""
					cancelHref="/emails"
					onSubmit={(values) => void handleUpdate(values)}
					onPreview={(values) => previewEditedEmailTemplate({ id: props.template.id, body: values.body })}
				/>
			</Show>

			<ConfirmDialog
				open={deleteOpen()}
				title="Delete email template?"
				description={`Permanently delete ${props.template.name}? This cannot be undone.`}
				confirmLabel="Delete template"
				pending={deletePending()}
				error={deleteError()}
				onConfirm={() => void handleDelete()}
				onOpenChange={setDeleteOpen}
			/>
		</section>
	);
}

function ReadOnlyEmailTemplate(props: { template: EmailTemplateDetail }) {
	const [previewPending, setPreviewPending] = createSignal(false);
	const [previewHtml, setPreviewHtml] = createSignal('');
	const [previewError, setPreviewError] = createSignal('');

	async function loadPreview(): Promise<void> {
		setPreviewPending(true);
		setPreviewError('');
		try {
			setPreviewHtml(await previewSavedEmailTemplate(props.template.id));
		} catch (caught) {
			setPreviewError(visibleError(caught, 'The template preview could not be rendered.'));
		} finally {
			setPreviewPending(false);
		}
	}

	return (
		<>
			<Show when={props.template.kind === 'campaign_visual'}>
				<p class="visual-template-note">Visual template content is read-only here. Its builder source must be edited with Listmonk's compatible visual editor.</p>
			</Show>
			<dl class="template-metadata">
				<div><dt>Type</dt><dd>{emailTemplateKindLabel(props.template.kind)}</dd></div>
				<div><dt>Subject</dt><dd>{props.template.subject || 'Not used'}</dd></div>
				<Show when={props.template.kind === 'campaign_visual'}>
					<div><dt>Visual source</dt><dd>{props.template.hasVisualSource ? 'Available in Listmonk' : 'Not reported by Listmonk'}</dd></div>
				</Show>
				<div><dt>Created</dt><dd>{new Date(props.template.createdAt).toLocaleString()}</dd></div>
				<div><dt>Updated</dt><dd>{new Date(props.template.updatedAt).toLocaleString()}</dd></div>
			</dl>
			<div class="template-source"><h2>HTML source</h2><pre><code>{props.template.body}</code></pre></div>
			<button class="button button--secondary" type="button" onClick={() => void loadPreview()} disabled={previewPending()}>
				{previewPending() ? 'Rendering…' : 'Render saved preview'}
			</button>
			<Show when={previewError()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<Show when={previewHtml()}>{(html) => <div class="template-read-preview"><iframe srcdoc={html()} sandbox="" referrerpolicy="no-referrer" title="Rendered email template preview" /></div>}</Show>
		</>
	);
}
