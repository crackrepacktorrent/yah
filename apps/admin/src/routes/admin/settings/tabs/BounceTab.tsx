import { For, Show, createSignal, untrack } from 'solid-js';
import * as v from 'valibot';
import { Button, FormField, Input, Section, Select, Switch } from '~/components/admin';
import { createForm } from '~/lib/use-form';
import type { TabProps } from '../email';

const bounceActionOptions = [
	{ value: 'none', label: 'None' },
	{ value: 'blocklist', label: 'Blocklist' },
	{ value: 'delete', label: 'Delete' },
];

const isCount = (s: string) => /^\d+$/.test(s) && Number(s) >= 1;

const BounceSchema = v.object({
	softCount: v.pipe(v.string(), v.check(isCount, 'Must be at least 1')),
	softAction: v.string(),
	hardCount: v.pipe(v.string(), v.check(isCount, 'Must be at least 1')),
	hardAction: v.string(),
	complaintCount: v.pipe(v.string(), v.check(isCount, 'Must be at least 1')),
	complaintAction: v.string(),
});

export function BounceTab(props: TabProps) {
	const s = untrack(() => props.settings);

	const [enabled, setEnabled] = createSignal(s['bounce.enabled'] ?? false);
	const [webhooksEnabled, setWebhooksEnabled] = createSignal(s['bounce.webhooks_enabled'] ?? false);
	const [sesEnabled, setSesEnabled] = createSignal(s['bounce.ses_enabled'] ?? false);
	const [sendgridEnabled, setSendgridEnabled] = createSignal(s['bounce.sendgrid_enabled'] ?? false);
	const [sendgridKey, setSendgridKey] = createSignal(s['bounce.sendgrid_key'] ?? '');
	const [postmarkEnabled, setPostmarkEnabled] = createSignal(s['bounce.postmark']?.enabled ?? false);
	const [postmarkUsername, setPostmarkUsername] = createSignal(s['bounce.postmark']?.username ?? '');
	const [postmarkPassword, setPostmarkPassword] = createSignal('');
	const [forwardemailEnabled, setForwardemailEnabled] = createSignal(s['bounce.forwardemail']?.enabled ?? false);
	const [forwardemailKey, setForwardemailKey] = createSignal(s['bounce.forwardemail']?.key ?? '');
	const [saving, setSaving] = createSignal(false);

	const form = createForm(BounceSchema, {
		softCount: String(s['bounce.actions'].soft.count ?? 3),
		softAction: s['bounce.actions'].soft.action ?? 'none',
		hardCount: String(s['bounce.actions'].hard.count ?? 1),
		hardAction: s['bounce.actions'].hard.action ?? 'blocklist',
		complaintCount: String(s['bounce.actions'].complaint.count ?? 1),
		complaintAction: s['bounce.actions'].complaint.action ?? 'blocklist',
	});

	const bounceRows = [
		{ label: 'Soft', countKey: 'softCount' as const, actionKey: 'softAction' as const },
		{ label: 'Hard', countKey: 'hardCount' as const, actionKey: 'hardAction' as const },
		{ label: 'Complaint', countKey: 'complaintCount' as const, actionKey: 'complaintAction' as const },
	];

	const handleSave = form.handleSubmit(async (values) => {
		setSaving(true);
		try {
			await props.onSave({
				'bounce.enabled': enabled(),
				'bounce.webhooks_enabled': webhooksEnabled(),
				'bounce.actions': {
					soft: { count: parseInt(values.softCount, 10), action: values.softAction as 'blocklist' | 'delete' | 'none' },
					hard: { count: parseInt(values.hardCount, 10), action: values.hardAction as 'blocklist' | 'delete' | 'none' },
					complaint: { count: parseInt(values.complaintCount, 10), action: values.complaintAction as 'blocklist' | 'delete' | 'none' },
				},
				'bounce.ses_enabled': sesEnabled(),
				'bounce.sendgrid_enabled': sendgridEnabled(),
				'bounce.sendgrid_key': sendgridKey(),
				'bounce.postmark': {
					enabled: postmarkEnabled(),
					username: postmarkUsername(),
					password: postmarkPassword() || s['bounce.postmark']?.password || '',
				},
				'bounce.forwardemail': {
					enabled: forwardemailEnabled(),
					key: forwardemailKey(),
				},
			});
		} finally {
			setSaving(false);
		}
	});

	return (
		<div class="settings-sections">
			<Section title="Processing">
				<div class="form-fields">
					<Switch label="Enable bounce processing" checked={enabled()} onChange={setEnabled} disabled={!props.canEdit} />
				</div>
			</Section>

			<Show when={enabled()}>
				<Section title="Actions">
					<div class="form-fields">
						<p class="settings-hint">Configure what happens when a subscriber accumulates bounces.</p>
						<div class="bounce-grid">
							<For each={bounceRows}>
								{(row) => (
									<div class="bounce-row">
										<span class="bounce-type">{row.label}</span>
										<FormField label="Count" error={form.fieldError(row.countKey)}>
											<Input
												type="number"
												{...form.field(row.countKey)}
												disabled={!props.canEdit}
											/>
										</FormField>
										<FormField label="Action">
											<Select
												value={form.values[row.actionKey]}
												onValueChange={(v) => form.setValue(row.actionKey, v as 'none' | 'blocklist' | 'delete')}
												options={bounceActionOptions}
												disabled={!props.canEdit}
											/>
										</FormField>
									</div>
								)}
							</For>
						</div>
					</div>
				</Section>

				<Section title="Webhook providers">
					<div class="form-fields">
						<Switch label="Enable bounce webhooks" checked={webhooksEnabled()} onChange={setWebhooksEnabled} disabled={!props.canEdit} />

						<Show when={webhooksEnabled()}>
							<Switch label="Amazon SES" checked={sesEnabled()} onChange={setSesEnabled} disabled={!props.canEdit} />

							<div class="provider-row">
								<Switch label="SendGrid" checked={sendgridEnabled()} onChange={setSendgridEnabled} disabled={!props.canEdit} />
								<Show when={sendgridEnabled()}>
									<FormField label="API Key">
										<Input type="password" value={sendgridKey()} onInput={(e) => setSendgridKey(e.currentTarget.value)} disabled={!props.canEdit} placeholder="SG.xxxx" />
									</FormField>
								</Show>
							</div>

							<div class="provider-row">
								<Switch label="Postmark" checked={postmarkEnabled()} onChange={setPostmarkEnabled} disabled={!props.canEdit} />
								<Show when={postmarkEnabled()}>
									<div class="form-row">
										<FormField label="Username">
											<Input value={postmarkUsername()} onInput={(e) => setPostmarkUsername(e.currentTarget.value)} disabled={!props.canEdit} />
										</FormField>
										<FormField label="Password">
											<Input type="password" value={postmarkPassword()} onInput={(e) => setPostmarkPassword(e.currentTarget.value)} disabled={!props.canEdit} />
										</FormField>
									</div>
								</Show>
							</div>

							<div class="provider-row">
								<Switch label="Forward Email" checked={forwardemailEnabled()} onChange={setForwardemailEnabled} disabled={!props.canEdit} />
								<Show when={forwardemailEnabled()}>
									<FormField label="API Key">
										<Input type="password" value={forwardemailKey()} onInput={(e) => setForwardemailKey(e.currentTarget.value)} disabled={!props.canEdit} />
									</FormField>
								</Show>
							</div>
						</Show>
					</div>
				</Section>
			</Show>

			<Show when={props.canEdit}>
				<div class="tab-actions">
					<Button onClick={handleSave} disabled={saving()}>{saving() ? 'Saving…' : 'Save'}</Button>
				</div>
			</Show>
		</div>
	);
}
