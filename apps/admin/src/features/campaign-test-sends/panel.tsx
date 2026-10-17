import { For, Show, createMemo, createSignal } from 'solid-js';
import type { CampaignSummary } from '~/features/campaigns/contracts';
import { listCampaigns } from '~/features/campaigns/server';
import type { SubscriberProfile } from '~/features/subscribers/contracts';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { sendCampaignTest } from './server';

export function CampaignTestSendPanel(props: { subscriber: SubscriberProfile }) {
	const campaigns = createMemo(() => listCampaigns());
	return <Show when={campaigns()}>{(catalog) => <CampaignTestSendControls subscriber={props.subscriber} campaigns={catalog()} />}</Show>;
}

function CampaignTestSendControls(props: { subscriber: SubscriberProfile; campaigns: CampaignSummary[] }) {
	const campaigns = createMemo(() => props.campaigns.filter((campaign) =>
		campaign.type === 'regular' &&
		campaign.status === 'draft' &&
		(campaign.messenger === 'email' || campaign.messenger.startsWith('email-')),
	));
	const [selectedId, setSelectedId] = createSignal('');
	const selectedCampaign = createMemo(() => campaigns().find(({ id }) => id === Number(selectedId())) ?? null);
	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const sendTask = createCommandTask();
	const [accepted, setAccepted] = createSignal('');

	function requestSend(): void {
		if (!selectedCampaign()) return;
		sendTask.clearError();
		setConfirmOpen(true);
	}

	async function performSend(): Promise<void> {
		const campaign = selectedCampaign();
		if (!campaign) return;
		const subscriber = props.subscriber;
		await sendTask.run(async () => {
			setAccepted('');
			await sendCampaignTest({
				campaignId: campaign.id,
				expectedCampaignUpdatedAt: campaign.updatedAt,
				subscriberId: subscriber.id,
				expectedSubscriberUpdatedAt: subscriber.updatedAt,
			});
			setConfirmOpen(false);
			const message = `Test-send request accepted for ${subscriber.email}. Delivery is not confirmed.`;
			setAccepted(message);
		}, 'The campaign test-send request could not be accepted.');
	}

	return <div class="campaign-test-send-panel">
		<p class="campaign-test-send-warning">This sends a real email with live subscriber-bound links. Opening it may add campaign views, clicks, or subscriber activity, and its unsubscribe link remains active.</p>
		<Show when={campaigns().length > 0} fallback={<p>No ordinary draft email campaigns are available.</p>}>
			<label class="form-field"><span>Draft campaign</span><select value={selectedId()} onChange={(event) => { setSelectedId(event.currentTarget.value); setAccepted(''); }}><option value="">Select a campaign</option><For each={campaigns()}>{(campaign: CampaignSummary) => <option value={campaign.id}>{campaign.name} — {campaign.subject}</option>}</For></select></label>
			<div class="subscriber-detail-actions"><button class="button" type="button" disabled={!selectedCampaign()} onClick={requestSend}>Review test email</button></div>
		</Show>
		<Show when={accepted()}>{(message) => <p class="campaign-test-send-accepted" role="status">{message()}</p>}</Show>
		<ConfirmDialog
			open={confirmOpen()}
			title="Send real test email?"
			description={selectedCampaign() ? `Ask Listmonk to queue ${selectedCampaign()!.name} for ${props.subscriber.email}. This is a real email with live links and tracking. Queue acceptance does not confirm delivery.` : ''}
			confirmLabel="Queue test email"
			confirmTone="primary"
			pending={sendTask.pending()}
			error={sendTask.error()}
			onConfirm={() => void performSend()}
			onOpenChange={(open) => { if (!open && !sendTask.pending()) setConfirmOpen(false); }}
		/>
	</div>;
}
