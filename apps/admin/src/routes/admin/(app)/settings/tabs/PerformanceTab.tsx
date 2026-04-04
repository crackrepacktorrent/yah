import { Show, createSignal, untrack } from 'solid-js';
import * as v from 'valibot';
import { Button, FormField, Input, Section, Switch } from '~/components';
import { createForm } from '~/lib/use-form';
import type { TabProps } from '../email';

const isWholeNumber = (s: string) => /^\d+$/.test(s);

const PerformanceSchema = v.object({
	concurrency: v.pipe(v.string(), v.check((s) => isWholeNumber(s) && Number(s) >= 1, 'Must be a whole number ≥ 1')),
	messageRate: v.pipe(v.string(), v.check(isWholeNumber, 'Must be a whole number')),
	batchSize: v.pipe(v.string(), v.check((s) => isWholeNumber(s) && Number(s) >= 1, 'Must be a whole number ≥ 1')),
	maxErrors: v.pipe(v.string(), v.check(isWholeNumber, 'Must be a whole number')),
	slidingWindow: v.boolean(),
	slidingWindowRate: v.pipe(v.string(), v.check(isWholeNumber, 'Must be a whole number')),
	slidingWindowDuration: v.pipe(v.string(), v.nonEmpty('Required')),
});

export function PerformanceTab(props: TabProps) {
	const s = untrack(() => props.settings);

	const form = createForm(PerformanceSchema, {
		concurrency: String(s['app.concurrency'] ?? 100),
		messageRate: String(s['app.message_rate'] ?? 0),
		batchSize: String(s['app.batch_size'] ?? 1000),
		maxErrors: String(s['app.max_send_errors'] ?? 1000),
		slidingWindow: s['app.message_sliding_window'] ?? false,
		slidingWindowRate: String(s['app.message_sliding_window_rate'] ?? 0),
		slidingWindowDuration: s['app.message_sliding_window_duration'] ?? '1h',
	});

	const [saving, setSaving] = createSignal(false);

	// eslint-disable-next-line solid/reactivity
	const handleSave = form.handleSubmit(async (values) => {
		setSaving(true);
		try {
			await props.onSave({
				'app.concurrency': parseInt(values.concurrency, 10),
				'app.message_rate': parseInt(values.messageRate, 10),
				'app.batch_size': parseInt(values.batchSize, 10),
				'app.max_send_errors': parseInt(values.maxErrors, 10),
				'app.message_sliding_window': values.slidingWindow,
				'app.message_sliding_window_rate': parseInt(values.slidingWindowRate, 10),
				'app.message_sliding_window_duration': values.slidingWindowDuration,
			});
		} finally {
			setSaving(false);
		}
	});

	return (
		<div class="settings-sections">
			<Section title="Throughput">
				<div class="form-fields">
					<div class="form-row">
						<FormField label="Concurrency" hint="Maximum concurrent worker threads that will attempt to send messages simultaneously." error={form.fieldError('concurrency')}>
							<Input type="number" {...form.field('concurrency')} disabled={!props.canEdit} />
						</FormField>
						<FormField label="Message rate" hint="Maximum messages to be sent out per second per worker. Total throughput = concurrency × message rate." error={form.fieldError('messageRate')}>
							<Input type="number" {...form.field('messageRate')} disabled={!props.canEdit} />
						</FormField>
					</div>
					<div class="form-row">
						<FormField label="Batch size" hint="Number of subscribers to pull from the database in a single iteration. Should be higher than concurrency × message rate." error={form.fieldError('batchSize')}>
							<Input type="number" {...form.field('batchSize')} disabled={!props.canEdit} />
						</FormField>
						<FormField label="Max error threshold" hint="Number of errors a running campaign should tolerate before it is paused. 0 = never pause." error={form.fieldError('maxErrors')}>
							<Input type="number" {...form.field('maxErrors')} disabled={!props.canEdit} />
						</FormField>
					</div>
				</div>
			</Section>

			<Section title="Sliding window">
				<div class="form-fields">
					<Switch
						label="Enable sliding window limit"
						hint="Limit the total number of messages sent in a given period. Messages are held from sending until the window clears."
						checked={form.values.slidingWindow}
						onChange={(v) => form.setValue('slidingWindow', v)}
						disabled={!props.canEdit}
					/>
					<Show when={form.values.slidingWindow}>
						<div class="form-row">
							<FormField label="Max messages" hint="Maximum number of messages to send within the window duration." error={form.fieldError('slidingWindowRate')}>
								<Input type="number" {...form.field('slidingWindowRate')} disabled={!props.canEdit} />
							</FormField>
							<FormField label="Duration" hint="Duration of the sliding window period (m for minute, h for hour)." error={form.fieldError('slidingWindowDuration')}>
								<Input {...form.field('slidingWindowDuration')} disabled={!props.canEdit} placeholder="1h" />
							</FormField>
						</div>
					</Show>
				</div>
			</Section>

			<Show when={props.canEdit}>
				<div class="tab-actions">
					<Button onClick={handleSave} disabled={saving()}>{saving() ? 'Saving…' : 'Save'}</Button>
				</div>
			</Show>
		</div>
	);
}
