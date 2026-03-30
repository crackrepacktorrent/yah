import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Show, createMemo, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Card, PageHeader, Tabs, TabContent } from '~/components/admin';
import { getSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import { getEmailSettings, updateEmailSettings } from '../settings.server';
import type { ListmonkSettings } from '~/server/listmonk';
import { GeneralTab } from './tabs/GeneralTab';
import { SmtpTab } from './tabs/SmtpTab';
import { PerformanceTab } from './tabs/PerformanceTab';
import { BounceTab } from './tabs/BounceTab';
import { PrivacyTab } from './tabs/PrivacyTab';
import './email.css';

export const route: RouteDefinition = {
	preload: () => { void getEmailSettings(); },
};

// Shared prop type for all tab components
export type TabProps = {
	settings: ListmonkSettings;
	canEdit: boolean;
	onSave: (p: Partial<ListmonkSettings>) => Promise<void>;
};

export default function EmailSettingsPage() {
	const session = createAsync(() => getSession());
	const settings = createAsync(() => getEmailSettings());
	const canEdit = createMemo(() => can(session(), 'settings', 'edit'));
	const [activeTab, setActiveTab] = createSignal('general');

	async function save(partial: Partial<ListmonkSettings>) {
		try {
			await updateEmailSettings(partial);
			toast.success('Settings saved.');
			await revalidate('getEmailSettings');
		} catch (err) {
			toastError(err, 'Failed to save settings.');
		}
	}

	return (
		<>
			<PageHeader title="Email Settings" />

			<Show when={settings()} keyed>
				{(s) => (
					<Card>
						<Tabs
							value={activeTab()}
							onChange={setActiveTab}
							tabs={[
								{ value: 'general', label: 'General' },
								{ value: 'smtp', label: 'SMTP' },
								{ value: 'performance', label: 'Performance' },
								{ value: 'bounce', label: 'Bounces' },
								{ value: 'privacy', label: 'Privacy' },
							]}
						>
							<TabContent value="general">
								<GeneralTab settings={s} canEdit={canEdit()} onSave={save} />
							</TabContent>
							<TabContent value="smtp">
								<SmtpTab settings={s} canEdit={canEdit()} onSave={save} />
							</TabContent>
							<TabContent value="performance">
								<PerformanceTab settings={s} canEdit={canEdit()} onSave={save} />
							</TabContent>
							<TabContent value="bounce">
								<BounceTab settings={s} canEdit={canEdit()} onSave={save} />
							</TabContent>
							<TabContent value="privacy">
								<PrivacyTab settings={s} canEdit={canEdit()} onSave={save} />
							</TabContent>
						</Tabs>
					</Card>
				)}
			</Show>
		</>
	);
}
