import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo } from 'solid-js';
import { emailTemplateKindLabel } from '~/features/email-templates/form';
import { emailTemplateHref } from '~/features/email-templates/routing';
import { listEmailTemplates } from '~/features/email-templates/server';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/emails', {
	preload: () => void listEmailTemplates(),
});

export default function EmailTemplateListPage() {
	const templates = createMemo(() => listEmailTemplates());
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => can(session(), 'template', 'create'));

	return (
		<section class="email-templates-page">
			<PageHeader eyebrow="Email delivery" title="Email templates">
				<Show when={canCreate()}><a class="button" href="/emails/templates/new">New template</a></Show>
			</PageHeader>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Email templates</caption>
					<thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Subject</th><th scope="col">Created</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={templates().length > 0} fallback={<tr><td colspan="5">No email templates yet.</td></tr>}>
							<For each={templates()}>
								{(template) => (
									<tr>
										<td><a class="email-template-name" href={emailTemplateHref(template.id)}>{template.name}</a></td>
										<td>
											<span class="badge">{emailTemplateKindLabel(template.kind)}</span>
											<Show when={template.isDefault}><span class="badge email-template-default">Default</span></Show>
										</td>
										<td>{template.subject || 'Not used'}</td>
										<td>{new Date(template.createdAt).toLocaleDateString()}</td>
										<td>{new Date(template.updatedAt).toLocaleDateString()}</td>
									</tr>
								)}
							</For>
						</Show>
					</tbody>
				</table>
			</div>
		</section>
	);
}
