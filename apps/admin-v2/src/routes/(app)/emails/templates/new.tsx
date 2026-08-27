import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo, createSignal } from 'solid-js';
import { EmailTemplateForm, type EmailTemplateFormValues } from '~/features/email-templates/form';
import { emailTemplateHref } from '~/features/email-templates/routing';
import {
	createEmailTemplate,
	listEmailTemplates,
	previewNewEmailTemplate,
	requireEmailTemplateCapability,
} from '~/features/email-templates/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/templates/new', {
	preload: () => void requireEmailTemplateCapability('create'),
});

export default function NewEmailTemplatePage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireEmailTemplateCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => session().permissions['template']?.includes('view') ?? false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function handleSubmit(values: EmailTemplateFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			const created = await createEmailTemplate(values);
			revalidate(listEmailTemplates.key);
			toast.success('Email template created.');
			navigate(canView() ? emailTemplateHref(created.id) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The email template could not be created.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="email-templates-page">
			{authorized()}
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href={canView() ? '/emails' : '/'}>{canView() ? 'Email templates' : 'Dashboard'}</a><span aria-hidden="true">/</span><span>New</span></nav>
			<h1>New email template</h1>
			<p>Create transactional email HTML or an HTML wrapper for campaign content.</p>
			<EmailTemplateForm
				mode="create"
				pending={pending()}
				error={error()}
				cancelHref={canView() ? '/emails' : '/'}
				onSubmit={(values) => void handleSubmit(values)}
				onPreview={(values) => previewNewEmailTemplate(values)}
			/>
		</section>
	);
}
