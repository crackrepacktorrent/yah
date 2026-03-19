<script lang="ts">
	import { Button, FormField, Input, Switch, Section } from '$lib/components/admin';
	import { useForm } from '$lib/utils/use-form.svelte';
	import * as v from 'valibot';
	import type { ListmonkSettings } from '$lib/server/listmonk';

	let {
		settings,
		canEdit,
		onsave,
	}: {
		settings: ListmonkSettings;
		canEdit: boolean;
		onsave: (partial: Record<string, unknown>) => Promise<void>;
	} = $props();

	const schema = v.object({
		concurrency: v.pipe(v.number(), v.minValue(1)),
		messageRate: v.pipe(v.number(), v.minValue(1)),
		batchSize: v.pipe(v.number(), v.minValue(1)),
		maxSendErrors: v.pipe(v.number(), v.minValue(0)),
		slidingWindow: v.boolean(),
		slidingWindowDuration: v.string(),
		slidingWindowRate: v.pipe(v.number(), v.minValue(1)),
	});

	const form = useForm({
		concurrency: settings['app.concurrency'],
		messageRate: settings['app.message_rate'],
		batchSize: settings['app.batch_size'],
		maxSendErrors: settings['app.max_send_errors'],
		slidingWindow: settings['app.message_sliding_window'],
		slidingWindowDuration: settings['app.message_sliding_window_duration'],
		slidingWindowRate: settings['app.message_sliding_window_rate'],
	}, schema);

	let saving = $state(false);

	async function handleSave() {
		if (!form.validate()) return;
		saving = true;
		try {
			await onsave({
				'app.concurrency': form.values.concurrency,
				'app.message_rate': form.values.messageRate,
				'app.batch_size': form.values.batchSize,
				'app.max_send_errors': form.values.maxSendErrors,
				'app.message_sliding_window': form.values.slidingWindow,
				'app.message_sliding_window_duration': form.values.slidingWindowDuration,
				'app.message_sliding_window_rate': form.values.slidingWindowRate,
			});
		} finally {
			saving = false;
		}
	}
</script>

<div class="settings-sections">
	<Section title="Throughput">
		<div class="form-fields">
			<div class="form-row">
				<FormField label="Concurrency" hint="Maximum concurrent worker threads that will attempt to send messages simultaneously.">
					<Input type="number" bind:value={form.values.concurrency} disabled={!canEdit} />
				</FormField>

				<FormField label="Message rate" hint="Maximum messages to be sent out per second per worker. Total throughput = concurrency × message rate.">
					<Input type="number" bind:value={form.values.messageRate} disabled={!canEdit} />
				</FormField>
			</div>

			<div class="form-row">
				<FormField label="Batch size" hint="Number of subscribers to pull from the database in a single iteration. Should be higher than concurrency × message rate.">
					<Input type="number" bind:value={form.values.batchSize} disabled={!canEdit} />
				</FormField>

				<FormField label="Max error threshold" hint="Number of errors a running campaign should tolerate before it is paused. 0 = never pause.">
					<Input type="number" bind:value={form.values.maxSendErrors} disabled={!canEdit} />
				</FormField>
			</div>
		</div>
	</Section>

	<Section title="Sliding window">
		<div class="form-fields">
			<Switch bind:checked={form.values.slidingWindow} label="Enable sliding window limit" hint="Limit the total number of messages sent in a given period. Messages are held from sending until the window clears." disabled={!canEdit} />
			{#if form.values.slidingWindow}
				<div class="form-row">
					<FormField label="Max messages" hint="Maximum number of messages to send within the window duration.">
						<Input type="number" bind:value={form.values.slidingWindowRate} disabled={!canEdit} />
					</FormField>

					<FormField label="Duration" hint="Duration of the sliding window period (m for minute, h for hour).">
						<Input bind:value={form.values.slidingWindowDuration} disabled={!canEdit} placeholder="1h" />
					</FormField>
				</div>
			{/if}
		</div>
	</Section>

	{#if canEdit}
		<div class="tab-actions">
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	{/if}
</div>

