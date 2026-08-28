import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { EmailTemplateForm, type EmailTemplateFormValues } from '~/features/email-templates/form';
import { emailTemplateHref } from '~/features/email-templates/routing';
import {
	createEmailTemplate,
	listEmailTemplates,
	previewNewEmailTemplate,
	requireEmailTemplateCapability,
} from '~/features/email-templates/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/templates/new', {
	preload: () => void requireEmailTemplateCapability('create'),
});

export default function NewEmailTemplatePage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireEmailTemplateCapability('create'));
	const session = createMemo(() => requireSession());
	const canView = createMemo(() => can(session(), 'template', 'view'));
	const createTask = createCommandTask();

	async function handleSubmit(values: EmailTemplateFormValues): Promise<void> {
		const canNavigateToTemplate = canView();
		await createTask.run(async () => {
			const created = await createEmailTemplate(values);
			revalidate(listEmailTemplates.key);
			toast.success('Email template created.');
			navigate(canNavigateToTemplate ? emailTemplateHref(created.id) : '/');
		}, 'The email template could not be created.');
	}

	return (
		<section class="email-templates-page">
			{authorized()}
			<Breadcrumbs items={[{ href: canView() ? '/emails' : '/', label: canView() ? 'Email templates' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New email template</h1>
			<p>Create transactional email HTML or an HTML wrapper for campaign content.</p>
			<EmailTemplateForm
				mode="create"
				pending={createTask.pending()}
				error={createTask.error()}
				cancelHref={canView() ? '/emails' : '/'}
				onSubmit={(values) => void handleSubmit(values)}
				onPreview={(values) => previewNewEmailTemplate(values)}
			/>
		</section>
	);
}
