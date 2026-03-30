import { createAsync, useParams, type RouteDefinition } from '@solidjs/router';
import { Show } from 'solid-js';
import { Spinner } from '~/components/admin';
import { getCampaign } from '../campaigns.server';
import { listLists } from '../lists.server';
import { listTemplates } from '../emails.server';
import { CampaignEditor } from './CampaignEditor';
import './CampaignEditor.css';

export const route: RouteDefinition = {
	preload: ({ params }) => {
		void getCampaign(Number(params['id']));
		void listLists();
		void listTemplates();
	},
};

export default function CampaignDetailPage() {
	const params = useParams();
	const campaign = createAsync(() => getCampaign(Number(params['id'])));

	return (
		<Show when={campaign()} fallback={<Spinner centered />}>
			{(c) => <CampaignEditor mode="edit" campaign={c()} />}
		</Show>
	);
}
