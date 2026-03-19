<script lang="ts">
	import { Badge, Button, DialogShell, FormField, Input, Select, MultiSelect, Switch, Table, Tabs, TabContent, Spinner, EmptyState } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { createSubscriber, updateSubscriber, getSubscriberBounces, getSubscriberExport, deleteSubscriberBounces, sendOptinConfirmation } from '../../subscribers.remote';
	import { subscriberStatusVariant } from '$lib/utils/admin';
	import { untrack } from 'svelte';
	import type { ListmonkList, ListmonkBounce, ListmonkSubscriber, ListmonkSubscriberExport } from '$lib/server/listmonk';

	let {
		open = $bindable(false),
		subscriber = null,
		allLists,
		canEdit,
		onSaved,
	}: {
		open: boolean;
		subscriber?: ListmonkSubscriber | null;
		allLists: ListmonkList[];
		canEdit: boolean;
		onSaved: () => void;
	} = $props();

	let isCreate = $derived(!subscriber);

	let activeTab = $state('details');
	let email = $state('');
	let name = $state('');
	let status = $state('enabled');
	let listIds = $state<string[]>([]);
	let preconfirm = $state(false);
	let saving = $state(false);

	// Bounces (edit mode only)
	let bounces = $state<ListmonkBounce[]>([]);
	let bouncesLoading = $state(false);
	let bouncesLoaded = $state(false);

	// Activity (edit mode only)
	let activity = $state<ListmonkSubscriberExport | null>(null);
	let activityLoading = $state(false);
	let activityLoaded = $state(false);

	// List options for MultiSelect — append "(unconfirmed)" for relevant subscriptions
	let listOptions = $derived(
		allLists.map((list) => {
			const subList = subscriber?.lists.find((l) => l.id === list.id);
			const unconfirmed = subList?.subscription_status === 'unconfirmed';
			return {
				value: String(list.id),
				label: list.name,
				detail: unconfirmed ? 'unconfirmed' : list.type,
			};
		}),
	);

	// Reset state when dialog opens — untrack subscriber to avoid re-running on prop changes
	$effect(() => {
		if (open) {
			untrack(() => {
				const sub = subscriber;
				if (sub) {
					email = sub.email;
					name = sub.name;
					status = sub.status;
					listIds = sub.lists.map((l) => String(l.id));
				} else {
					email = '';
					name = '';
					status = 'enabled';
					listIds = [];
				}
				preconfirm = false;
				activeTab = 'details';
				bouncesLoaded = false;
				bounces = [];
				activityLoaded = false;
				activity = null;
			});
		}
	});

	async function loadBounces() {
		if (!subscriber || bouncesLoaded) return;
		bouncesLoading = true;
		try {
			bounces = await getSubscriberBounces(subscriber.id);
		} catch (err) {
			toastError(err, 'Failed to load bounces.');
		} finally {
			bouncesLoading = false;
			bouncesLoaded = true;
		}
	}

	async function loadActivity() {
		if (!subscriber || activityLoaded) return;
		activityLoading = true;
		try {
			activity = await getSubscriberExport(subscriber.id);
		} catch (err) {
			toastError(err, 'Failed to load activity.');
		} finally {
			activityLoading = false;
			activityLoaded = true;
		}
	}

	// Lazy-load tab data
	$effect(() => {
		if (activeTab === 'bounces') loadBounces();
		if (activeTab === 'activity') loadActivity();
	});

	async function handleSave() {
		if (!email.trim()) {
			toast.error('Email is required.');
			return;
		}
		saving = true;
		try {
			if (isCreate) {
				await createSubscriber({
					email,
					name: name || undefined,
					status,
					listIds: listIds.length ? listIds.map(Number) : undefined,
					preconfirm: preconfirm || undefined,
				});
				toast.success('Subscriber created.');
			} else {
				await updateSubscriber({
					id: subscriber!.id,
					email,
					name,
					status,
					listIds: listIds.map(Number),
					preconfirm: preconfirm || undefined,
				});
				toast.success('Subscriber updated.');
			}
			open = false;
			onSaved();
		} catch (err) {
			toastError(err, isCreate ? 'Failed to create subscriber.' : 'Failed to update subscriber.');
		} finally {
			saving = false;
		}
	}

	async function handleResendOptin() {
		if (!subscriber) return;
		try {
			await sendOptinConfirmation(subscriber.id);
			toast.success(`Opt-in confirmation sent to ${subscriber.email}.`);
		} catch (err) {
			toastError(err, 'Failed to send opt-in confirmation.');
		}
	}

	async function handleClearBounces() {
		if (!subscriber) return;
		try {
			await deleteSubscriberBounces(subscriber.id);
			bounces = [];
			toast.success('Bounces cleared.');
		} catch (err) {
			toastError(err, 'Failed to clear bounces.');
		}
	}


	let hasUnconfirmed = $derived(
		subscriber?.status === 'enabled' && subscriber.lists.some((l) => l.subscription_status === 'unconfirmed'),
	);

	let tabs = $derived(isCreate
		? [{ value: 'details', label: 'Details' }, { value: 'lists', label: 'Lists' }]
		: [
			{ value: 'details', label: 'Details' },
			{ value: 'lists', label: `Lists (${subscriber!.lists.length})` },
			{ value: 'subscriptions', label: `Subscriptions (${subscriber!.lists.length})` },
			{ value: 'bounces', label: 'Bounces' },
			{ value: 'activity', label: 'Activity' },
		],
	);
</script>

<DialogShell bind:open title={isCreate ? 'New Subscriber' : subscriber!.email} maxWidth="800px">
	{#if !isCreate && subscriber}
		<div class="sub-header">
			<Badge variant={subscriberStatusVariant(subscriber.status)}>{subscriber.status}</Badge>
			<span class="sub-meta">ID: {subscriber.id}</span>
			<span class="sub-meta">Created: {new Date(subscriber.created_at).toLocaleDateString()}</span>
		</div>
	{/if}

	<Tabs bind:value={activeTab} {tabs}>
		<TabContent value="details">
			<div class="form-fields">
				<FormField label="Email" required>
					<Input type="email" bind:value={email} disabled={!canEdit} placeholder="subscriber@example.com" />
				</FormField>

				<div class="form-row">
					<FormField label="Name">
						<Input bind:value={name} disabled={!canEdit} placeholder="Full name" />
					</FormField>
					<FormField label="Status" hint="Blocklisted subscribers will never receive any emails.">
						<Select bind:value={status} options={[{ value: 'enabled', label: 'Enabled' }, { value: 'blocklisted', label: 'Blocklisted' }]} disabled={!canEdit} />
					</FormField>
				</div>
			</div>
		</TabContent>

		<TabContent value="lists">
			<div class="form-fields">
				<FormField label="Lists" hint="Lists from which subscribers have unsubscribed themselves cannot be removed.">
					<MultiSelect
						bind:selected={listIds}
						options={listOptions}
						placeholder="Search lists..."
						disabled={!canEdit}
					/>
				</FormField>

				<div class="list-footer">
					<Switch bind:checked={preconfirm} label="Preconfirm subscriptions" hint="Don't send opt-in e-mails and mark all list subscriptions as 'subscribed'." disabled={!canEdit} />

					{#if hasUnconfirmed && canEdit}
						<Button variant="ghost" onclick={handleResendOptin}>Send opt-in confirmation</Button>
					{/if}
				</div>
			</div>
		</TabContent>

		{#if !isCreate}
			<TabContent value="subscriptions">
				{#if subscriber!.lists.length === 0}
					<EmptyState message="Not subscribed to any lists." />
				{:else}
					<Table>
						<thead>
							<tr>
								<th>List</th>
								<th>Status</th>
								<th>Created</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{#each subscriber!.lists as list}
								<tr>
									<td>
										<div class="sub-list-name">
											<span>{list.name}</span>
											{#if list.optin}
												<span class="sub-list-optin">{list.optin === 'double' ? 'Double opt-in' : 'Single opt-in'}</span>
											{/if}
										</div>
									</td>
									<td>
										<Badge variant={list.subscription_status === 'unconfirmed' ? 'warning' : 'success'}>
											{list.subscription_status}
										</Badge>
									</td>
									<td class="cell-date">{list.subscription_created_at ? new Date(list.subscription_created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
									<td class="cell-date">{list.subscription_updated_at ? new Date(list.subscription_updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				{/if}
			</TabContent>

			<TabContent value="bounces">
				{#if bouncesLoading}
					<Spinner centered />
				{:else if bounces.length === 0}
					<EmptyState message="No bounces recorded." />
				{:else}
					<div class="bounce-list">
						{#each bounces as bounce}
							<div class="bounce-item">
								<Badge variant={bounce.type === 'hard' ? 'error' : bounce.type === 'soft' ? 'warning' : 'info'}>{bounce.type}</Badge>
								<span class="bounce-source">{bounce.source || '—'}</span>
								<span class="bounce-date">{new Date(bounce.created_at).toLocaleDateString()}</span>
							</div>
						{/each}
					</div>
					{#if canEdit}
						<div class="section-actions">
							<Button variant="danger-outline" onclick={handleClearBounces}>Clear bounces</Button>
						</div>
					{/if}
				{/if}
			</TabContent>

			<TabContent value="activity">
				{#if activityLoading}
					<Spinner centered />
				{:else if !activity}
					<EmptyState message="No activity data." />
				{:else}
					<div class="activity-sections">
						{#if activity.campaign_views.length > 0}
							<div class="activity-section">
								<h4>Campaign views</h4>
								<div class="activity-list">
									{#each activity.campaign_views as view}
										<div class="activity-item">
											<span class="activity-name">{view.name}</span>
											<span class="activity-subject">{view.subject}</span>
											<Badge>{view.count} view{view.count !== 1 ? 's' : ''}</Badge>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if activity.link_clicks.length > 0}
							<div class="activity-section">
								<h4>Link clicks</h4>
								<div class="activity-list">
									{#each activity.link_clicks as click}
										<div class="activity-item">
											<span class="activity-url">{click.url}</span>
											<Badge>{click.count} click{click.count !== 1 ? 's' : ''}</Badge>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if activity.campaign_views.length === 0 && activity.link_clicks.length === 0}
							<EmptyState message="No campaign views or link clicks recorded." />
						{/if}
					</div>
				{/if}
			</TabContent>
		{/if}
	</Tabs>

	<div class="dialog-actions">
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
		{#if canEdit}
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? (isCreate ? 'Creating...' : 'Saving...') : (isCreate ? 'Create' : 'Save')}
			</Button>
		{/if}
	</div>
</DialogShell>

<style>
	.sub-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.sub-meta {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.list-footer {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	/* ─── Bounces ─────────────────────────────────────────────── */

	.bounce-list {
		display: flex;
		flex-direction: column;
	}

	.bounce-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-light);
		font-size: 0.85rem;
	}

	.bounce-item:last-child {
		border-bottom: none;
	}

	.bounce-source {
		flex: 1;
		color: var(--color-muted);
		font-family: monospace;
		font-size: 0.8rem;
	}

	.bounce-date {
		color: var(--color-muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.section-actions {
		margin-top: 0.75rem;
	}

	/* ─── Subscriptions ───────────────────────────────────────── */

	.sub-list-name {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.sub-list-optin {
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	/* ─── Activity ────────────────────────────────────────────── */

	.activity-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.activity-section h4 {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-foreground);
		margin: 0 0 0.5rem;
	}

	.activity-list {
		display: flex;
		flex-direction: column;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--color-border-light);
		font-size: 0.85rem;
	}

	.activity-item:last-child {
		border-bottom: none;
	}

	.activity-name {
		font-weight: 500;
		color: var(--color-foreground);
	}

	.activity-subject {
		flex: 1;
		color: var(--color-muted);
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.activity-url {
		flex: 1;
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
