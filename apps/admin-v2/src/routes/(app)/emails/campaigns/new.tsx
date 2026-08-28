import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { CampaignForm, type CampaignFormValues } from '~/features/campaigns/form';
import { campaignHref } from '~/features/campaigns/routing';
import { createCampaign, listCampaigns, requireCampaignCapability } from '~/features/campaigns/server';
import { listEmailTemplates } from '~/features/email-templates/server';
import { listMailingLists } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/campaigns/new', {
	preload: () => {
		void requireCampaignCapability('create');
		void listMailingLists();
	},
});

export default function NewCampaignPage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireCampaignCapability('create'));
	const session = createMemo(() => requireSession());
	const lists = createMemo(() => listMailingLists());
	const canViewCampaigns = createMemo(() => can(session(), 'campaign', 'view'));
	const canViewTemplates = createMemo(() => can(session(), 'template', 'view'));
	const templates = createMemo(() => canViewTemplates() ? listEmailTemplates() : []);
	const createTask = createCommandTask();

	async function submit(values: CampaignFormValues): Promise<void> {
		const canNavigateToCampaign = canViewCampaigns();
		await createTask.run(async () => {
			const created = await createCampaign(values);
			revalidate(listCampaigns.key);
			toast.success('Campaign draft created.');
			navigate(canNavigateToCampaign ? campaignHref(created.id) : '/');
		}, 'The campaign draft could not be created.');
	}

	return (
		<section class="campaigns-page">
			{authorized()}
			<Breadcrumbs items={[{ href: canViewCampaigns() ? '/emails/campaigns' : '/', label: canViewCampaigns() ? 'Campaigns' : 'Dashboard' }, { label: 'New' }]} />
			<h1>New campaign</h1>
			<p>Create a reviewable draft. Sending or scheduling remains a separate, confirmed action.</p>
			<CampaignForm mode="create" lists={lists()} templates={templates()} pending={createTask.pending()} error={createTask.error()} cancelHref={canViewCampaigns() ? '/emails/campaigns' : '/'} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
