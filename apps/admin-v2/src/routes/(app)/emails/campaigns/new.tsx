import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo, createSignal } from 'solid-js';
import { CampaignForm, type CampaignFormValues } from '~/features/campaigns/form';
import { campaignHref } from '~/features/campaigns/routing';
import { createCampaign, listCampaigns, requireCampaignCapability } from '~/features/campaigns/server';
import { listEmailTemplates } from '~/features/email-templates/server';
import { listMailingLists } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

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
	const canViewCampaigns = createMemo(() => session().permissions['campaign']?.includes('view') ?? false);
	const canViewTemplates = createMemo(() => session().permissions['template']?.includes('view') ?? false);
	const templates = createMemo(() => canViewTemplates() ? listEmailTemplates() : []);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function submit(values: CampaignFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			const created = await createCampaign(values);
			revalidate(listCampaigns.key);
			toast.success('Campaign draft created.');
			navigate(canViewCampaigns() ? campaignHref(created.id) : '/');
		} catch (caught) {
			setError(visibleError(caught, 'The campaign draft could not be created.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="campaigns-page">
			{authorized()}
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href={canViewCampaigns() ? '/emails/campaigns' : '/'}>{canViewCampaigns() ? 'Campaigns' : 'Dashboard'}</a><span aria-hidden="true">/</span><span>New</span></nav>
			<h1>New campaign</h1>
			<p>Create a reviewable draft. Sending or scheduling remains a separate, confirmed action.</p>
			<CampaignForm mode="create" lists={lists()} templates={templates()} pending={pending()} error={error()} cancelHref={canViewCampaigns() ? '/emails/campaigns' : '/'} onSubmit={(values) => void submit(values)} />
		</section>
	);
}
