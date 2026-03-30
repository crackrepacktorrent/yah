import type { RouteDefinition } from '@solidjs/router';
import { CampaignEditor } from './CampaignEditor';
import { listLists } from '../lists.server';
import { listTemplates } from '../emails.server';
import './CampaignEditor.css';

export const route: RouteDefinition = {
	preload: () => {
		void listLists();
		void listTemplates();
	},
};

export default function NewCampaignPage() {
	return <CampaignEditor mode="create" />;
}
