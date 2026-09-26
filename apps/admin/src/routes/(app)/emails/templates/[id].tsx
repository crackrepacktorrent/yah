import { can } from '@yah/admin-core/permissions';
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
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { PageHeader } from '~/ui/page-header';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/templates/:id', {
	matchFilters: { id: (segment) => decodeEmailTemplateRouteId(segment) > 0 },
	preload: ({ params }) => void getEmailTemplate(decodeEmailTemplateRouteId(params.id)),
});

export default function EmailTemplateDetailPage(props: RouteProps<typeof route>) {
	const templateId = createMemo(() => decodeEmailTemplateRouteId(props.params.id));
	return <Show when={templateId()} keyed>{(resolved) => <EmailTemplateRoute templateId={resolved} />}</Show>;
}

function EmailTemplateRoute(props: { templateId: number }) {
	const template = createMemo(() => getEmailTemplate(props.templateId));
	return <Show when={template()}>{(resolved) => <EmailTemplateDetailView template={resolved()} />}</Show>;
}

function EmailTemplateDetailView(props: { template: EmailTemplateDetail }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(
		() => can(session(), 'template', 'edit') && props.template.kind !== 'campaign_visual',
	);
	const canDelete = createMemo(
		() => can(session(), 'template', 'delete') && !props.template.isDefault,
	);
	const canSetDefault = createMemo(
		() =>
			can(session(), 'template', 'set-default') &&
			props.template.kind === 'campaign' &&
			!props.template.isDefault,
	);
	const updateTask = createCommandTask();
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const deleteTask = createCommandTask();
	const defaultTask = createCommandTask();

	async function handleUpdate(values: EmailTemplateFormValues): Promise<void> {
		const id = props.template.id;
		defaultTask.clearError();
		await updateTask.run(async () => {
			await updateEmailTemplate({ id, name: values.name, subject: values.subject, body: values.body });
			revalidate([getEmailTemplate.keyFor(id), listEmailTemplates.key]);
			toast.success('Email template updated.');
		}, 'The email template could not be updated.');
	}

	async function handleSetDefault(): Promise<void> {
		const id = props.template.id;
		updateTask.clearError();
		await defaultTask.run(async () => {
			await setDefaultEmailTemplate(id);
			revalidate([getEmailTemplate.keyFor(id), listEmailTemplates.key]);
			toast.success('Default campaign template updated.');
		}, 'The default template could not be changed.');
	}

	async function handleDelete(): Promise<void> {
		const id = props.template.id;
		await deleteTask.run(async () => {
			await deleteEmailTemplate(id);
			revalidate(listEmailTemplates.key);
			setDeleteOpen(false);
			toast.success('Email template deleted.');
			navigate('/emails');
		}, 'The email template could not be deleted.');
	}

	return (
		<section class="email-templates-page">
			<Breadcrumbs items={[{ href: '/emails', label: 'Email templates' }, { label: props.template.name }]} />
			<PageHeader title={props.template.name} description={`${emailTemplateKindLabel(props.template.kind)}${props.template.isDefault ? ' · Default campaign template' : ''}`}>
				<div class="template-detail-actions">
					<Show when={canSetDefault()}>
						<button class="button button--secondary" type="button" onClick={() => void handleSetDefault()} disabled={defaultTask.pending()}>
							{defaultTask.pending() ? 'Updating…' : 'Set as default'}
						</button>
					</Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete</button></Show>
				</div>
			</PageHeader>
			<Show when={updateTask.error() || defaultTask.error()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>

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
					pending={updateTask.pending()}
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
				pending={deleteTask.pending()}
				error={deleteTask.error()}
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
			<dl class="template-metadata metadata-list">
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
