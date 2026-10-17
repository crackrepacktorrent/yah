import { revalidate } from '@solidjs/router';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import type { BounceSummary } from './contracts';
import { bounceTypeLabel } from './presentation';
import { clearSubscriberBounces, listSubscriberBounces } from './server';

export function SubscriberBounceHistory(props: { subscriberId: number; email: string; canClear: boolean }) {
	const rows = createMemo(() => listSubscriberBounces(props.subscriberId));
	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const clearTask = createCommandTask();

	async function clearHistory(): Promise<void> {
		const id = props.subscriberId;
		await clearTask.run(async () => {
			await clearSubscriberBounces(id);
			revalidate(listSubscriberBounces.keyFor(id));
			setConfirmOpen(false);
			toast.success('Subscriber bounce history cleared.');
		}, 'The subscriber bounce history could not be cleared.');
	}

	return <Show when={rows()}>{(resolved) => <>
		<Show when={props.canClear && resolved().length > 0}><div class="subscriber-detail-actions"><button class="button button--danger-secondary" type="button" onClick={() => { clearTask.clearError(); setConfirmOpen(true); }}>Clear subscriber bounce history</button></div></Show>
		<div class="data-table-scroll">
			<table class="data-table">
				<caption class="visually-hidden">Bounce history for {props.email}</caption>
				<thead><tr><th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
				<tbody><Show when={resolved().length > 0} fallback={<tr><td colspan="4">No bounce records for this subscriber.</td></tr>}><For each={resolved()}>{(bounce: BounceSummary) => <tr><td>{bounce.campaignName ?? '—'}</td><td><span class={`badge bounce-type bounce-type--${bounce.type}`}>{bounceTypeLabel(bounce.type)}</span></td><td>{bounce.source || '—'}</td><td>{new Date(bounce.createdAt).toLocaleString()}</td></tr>}</For></Show></tbody>
			</table>
		</div>
		<ConfirmDialog open={confirmOpen()} title="Clear subscriber bounce history?" description={`Permanently clear every bounce record for ${props.email}? This does not restore subscriber or membership state and cannot be undone.`} confirmLabel="Clear bounce history" pending={clearTask.pending()} error={clearTask.error()} onConfirm={() => void clearHistory()} onOpenChange={setConfirmOpen} />
	</>}</Show>;
}
