import { type Component, For, Show, batch, createEffect, createMemo, createSignal, on } from 'solid-js';
import { toast } from 'solid-sonner';
import {
	Badge, Button, Dialog, EmptyState, FormField, Input, Select, Spinner, Switch, Tabs, TabContent,
} from '~/components';
import { MultiSelect } from '~/components';
import { subscriberStatusVariant, toastError } from '~/lib/utils';
import {
	createSubscriber, updateSubscriber,
	getSubscriberBounces, getSubscriberExport,
	deleteSubscriberBounces, sendOptinConfirmation,
} from '../subscribers.server';
import './SubscriberEditor.css';

type ListmonkList = {
	id: number;
	name: string;
	type: string;
};

type SubscriberList = {
	id: number;
	name: string;
	subscription_status: string;
	subscription_created_at?: string;
	subscription_updated_at?: string;
	optin?: string;
};

type ListmonkSubscriber = {
	id: number;
	email: string;
	name: string;
	status: string;
	lists: SubscriberList[];
	created_at: string;
};

type Bounce = {
	id: number;
	type: string;
	source: string;
	created_at: string;
};

type SubscriberExport = {
	campaign_views: { name: string; subject: string; count: number }[];
	link_clicks: { url: string; count: number }[];
};

type SubscriberEditorProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	subscriber?: ListmonkSubscriber | null;
	allLists: ListmonkList[];
	canEdit: boolean;
	onSaved: () => void;
};

export const SubscriberEditor: Component<SubscriberEditorProps> = (props) => {
	const isCreate = () => !props.subscriber;

	const [activeTab, setActiveTab] = createSignal('details');
	const [email, setEmail] = createSignal('');
	const [name, setName] = createSignal('');
	const [status, setStatus] = createSignal('enabled');
	const [listIds, setListIds] = createSignal<string[]>([]);
	const [preconfirm, setPreconfirm] = createSignal(false);
	const [saving, setSaving] = createSignal(false);

	const [bounces, setBounces] = createSignal<Bounce[]>([]);
	const [bouncesLoading, setBouncesLoading] = createSignal(false);
	const [bouncesLoaded, setBouncesLoaded] = createSignal(false);

	const [activity, setActivity] = createSignal<SubscriberExport | null>(null);
	const [activityLoading, setActivityLoading] = createSignal(false);
	const [activityLoaded, setActivityLoaded] = createSignal(false);

	const listOptions = createMemo(() =>
		props.allLists.map((list) => {
			const subList = props.subscriber?.lists.find((l) => l.id === list.id);
			const unconfirmed = subList?.subscription_status === 'unconfirmed';
			return {
				value: String(list.id),
				label: list.name,
				detail: unconfirmed ? 'unconfirmed' : list.type,
			};
		}),
	);

	const tabs = createMemo(() =>
		isCreate()
			? [{ value: 'details', label: 'Details' }, { value: 'lists', label: 'Lists' }]
			: [
				{ value: 'details', label: 'Details' },
				{ value: 'lists', label: `Lists (${props.subscriber!.lists.length})` },
				{ value: 'subscriptions', label: `Subscriptions (${props.subscriber!.lists.length})` },
				{ value: 'bounces', label: 'Bounces' },
				{ value: 'activity', label: 'Activity' },
			],
	);

	const hasUnconfirmed = createMemo(() =>
		props.subscriber?.status === 'enabled' &&
		props.subscriber.lists.some((l) => l.subscription_status === 'unconfirmed'),
	);

	// Initialize form fields when dialog opens.
	// Kobalte only fires onOpenChange for user-initiated close actions — not when
	// open={true} is set programmatically — so initialization must live here.
	createEffect(on(() => props.open, (open) => {
		if (!open) return;
		const sub = props.subscriber;
		batch(() => {
			setActiveTab('details');
			setBouncesLoaded(false);
			setBounces([]);
			setActivityLoaded(false);
			setActivity(null);
			setPreconfirm(false);
			if (sub) {
				setEmail(sub.email);
				setName(sub.name);
				setStatus(sub.status);
				setListIds(sub.lists.map((l) => String(l.id)));
			} else {
				setEmail('');
				setName('');
				setStatus('enabled');
				setListIds([]);
			}
		});
	}));

	function handleOpenChange(open: boolean) {
		props.onOpenChange(open);
	}

	async function loadBounces() {
		if (!props.subscriber || bouncesLoaded()) return;
		setBouncesLoading(true);
		try {
			const data = await getSubscriberBounces(props.subscriber.id);
			setBounces(data);
		} catch (err) {
			toastError(err, 'Failed to load bounces.');
		} finally {
			setBouncesLoading(false);
			setBouncesLoaded(true);
		}
	}

	async function loadActivity() {
		if (!props.subscriber || activityLoaded()) return;
		setActivityLoading(true);
		try {
			const data = await getSubscriberExport(props.subscriber.id);
			setActivity(data);
		} catch (err) {
			toastError(err, 'Failed to load activity.');
		} finally {
			setActivityLoading(false);
			setActivityLoaded(true);
		}
	}

	function handleTabChange(tab: string) {
		setActiveTab(tab);
		if (tab === 'bounces') loadBounces();
		if (tab === 'activity') loadActivity();
	}

	async function handleSave() {
		if (!email().trim()) {
			toast.error('Email is required.');
			return;
		}
		setSaving(true);
		try {
			if (isCreate()) {
				await createSubscriber({
					email: email(),
					name: name() || undefined,
					status: status(),
					listIds: listIds().length ? listIds().map(Number) : undefined,
					preconfirm: preconfirm() || undefined,
				});
				toast.success('Subscriber created.');
			} else {
				await updateSubscriber({
					id: props.subscriber!.id,
					email: email(),
					name: name(),
					status: status(),
					listIds: listIds().map(Number),
					preconfirm: preconfirm() || undefined,
				});
				toast.success('Subscriber updated.');
			}
			props.onOpenChange(false);
			props.onSaved();
		} catch (err) {
			toastError(err, isCreate() ? 'Failed to create subscriber.' : 'Failed to update subscriber.');
		} finally {
			setSaving(false);
		}
	}

	async function handleResendOptin() {
		if (!props.subscriber) return;
		try {
			await sendOptinConfirmation(props.subscriber.id);
			toast.success(`Opt-in confirmation sent to ${props.subscriber.email}.`);
		} catch (err) {
			toastError(err, 'Failed to send opt-in confirmation.');
		}
	}

	async function handleClearBounces() {
		if (!props.subscriber) return;
		try {
			await deleteSubscriberBounces(props.subscriber.id);
			setBounces([]);
			toast.success('Bounces cleared.');
		} catch (err) {
			toastError(err, 'Failed to clear bounces.');
		}
	}

	return (
		<Dialog
			open={props.open}
			onOpenChange={handleOpenChange}
			title={isCreate() ? 'New Subscriber' : props.subscriber!.email}
			maxWidth="800px"
			footer={<>
				<Button variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
				<Show when={props.canEdit}>
					<Button onClick={handleSave} disabled={saving()}>
						{saving()
							? (isCreate() ? 'Creating…' : 'Saving…')
							: (isCreate() ? 'Create' : 'Save')}
					</Button>
				</Show>
			</>}
		>
			<Show when={!isCreate() && props.subscriber}>
				{(sub) => (
					<div class="sub-header">
						<Badge variant={subscriberStatusVariant(sub().status)}>{sub().status}</Badge>
						<span class="sub-meta">ID: {sub().id}</span>
						<span class="sub-meta">Created: {new Date(sub().created_at).toLocaleDateString()}</span>
					</div>
				)}
			</Show>

			<Tabs value={activeTab()} onChange={handleTabChange} tabs={tabs()}>
				<TabContent value="details">
					<div class="form-fields">
						<FormField label="Email" required>
							<Input
								type="email"
								placeholder="subscriber@example.com"
								value={email()}
								onInput={(e) => setEmail(e.currentTarget.value)}
								disabled={!props.canEdit}
							/>
						</FormField>
						<div class="form-row">
							<FormField label="Name">
								<Input
									placeholder="Full name"
									value={name()}
									onInput={(e) => setName(e.currentTarget.value)}
									disabled={!props.canEdit}
								/>
							</FormField>
							<FormField label="Status" hint="Disabled subscribers won't receive emails until re-enabled. Blocklisted subscribers are permanently excluded.">
								<Select
									value={status()}
									onValueChange={setStatus}
									options={[
										{ value: 'enabled', label: 'Enabled' },
										{ value: 'disabled', label: 'Disabled' },
										{ value: 'blocklisted', label: 'Blocklisted' },
									]}
									disabled={!props.canEdit}
								/>
							</FormField>
						</div>
					</div>
				</TabContent>

				<TabContent value="lists">
					<div class="form-fields">
						<FormField label="Lists" hint="Lists from which subscribers have unsubscribed themselves cannot be removed.">
							<MultiSelect
								selected={listIds()}
								onChange={setListIds}
								options={listOptions()}
								placeholder="Search lists…"
								disabled={!props.canEdit}
							/>
						</FormField>
						<div class="list-footer">
							<Switch
								label="Preconfirm subscriptions"
								hint="Don't send opt-in e-mails and mark all list subscriptions as 'subscribed'."
								checked={preconfirm()}
								onChange={setPreconfirm}
								disabled={!props.canEdit}
							/>
							<Show when={hasUnconfirmed() && props.canEdit}>
								<Button variant="ghost" onClick={handleResendOptin}>Send opt-in confirmation</Button>
							</Show>
						</div>
					</div>
				</TabContent>

				<Show when={!isCreate()}>
					<TabContent value="subscriptions">
						<Show
							when={props.subscriber!.lists.length > 0}
							fallback={<EmptyState message="Not subscribed to any lists." />}
						>
							<table class="sub-table">
								<thead>
									<tr>
										<th>List</th>
										<th>Status</th>
										<th>Created</th>
										<th>Updated</th>
									</tr>
								</thead>
								<tbody>
									<For each={props.subscriber!.lists}>
										{(list) => (
											<tr>
												<td>
													<div class="sub-list-name">
														<span>{list.name}</span>
														<Show when={list.optin}>
															<span class="sub-list-optin">{list.optin === 'double' ? 'Double opt-in' : 'Single opt-in'}</span>
														</Show>
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
										)}
									</For>
								</tbody>
							</table>
						</Show>
					</TabContent>

					<TabContent value="bounces">
						<Show
							when={!bouncesLoading()}
							fallback={<Spinner centered />}
						>
							<Show
								when={bounces().length > 0}
								fallback={<EmptyState message="No bounces recorded." />}
							>
								<div class="bounce-list">
									<For each={bounces()}>
										{(bounce) => (
											<div class="bounce-item">
												<Badge variant={bounce.type === 'hard' ? 'error' : bounce.type === 'soft' ? 'warning' : 'info'}>{bounce.type}</Badge>
												<span class="bounce-source">{bounce.source || '—'}</span>
												<span class="bounce-date">{new Date(bounce.created_at).toLocaleDateString()}</span>
											</div>
										)}
									</For>
								</div>
								<Show when={props.canEdit}>
									<div class="section-actions">
										<Button variant="danger-outline" onClick={handleClearBounces}>Clear bounces</Button>
									</div>
								</Show>
							</Show>
						</Show>
					</TabContent>

					<TabContent value="activity">
						<Show
							when={!activityLoading()}
							fallback={<Spinner centered />}
						>
							<Show when={activity()} fallback={<EmptyState message="No activity data." />}>
								{(act) => (
									<div class="activity-sections">
										<Show when={act().campaign_views.length > 0}>
											<div class="activity-section">
												<h4>Campaign views</h4>
												<div class="activity-list">
													<For each={act().campaign_views}>
														{(view) => (
															<div class="activity-item">
																<span class="activity-name">{view.name}</span>
																<span class="activity-subject">{view.subject}</span>
																<Badge>{view.count} view{view.count !== 1 ? 's' : ''}</Badge>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>
										<Show when={act().link_clicks.length > 0}>
											<div class="activity-section">
												<h4>Link clicks</h4>
												<div class="activity-list">
													<For each={act().link_clicks}>
														{(click) => (
															<div class="activity-item">
																<span class="activity-url">{click.url}</span>
																<Badge>{click.count} click{click.count !== 1 ? 's' : ''}</Badge>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>
										<Show when={act().campaign_views.length === 0 && act().link_clicks.length === 0}>
											<EmptyState message="No campaign views or link clicks recorded." />
										</Show>
									</div>
								)}
							</Show>
						</Show>
					</TabContent>
				</Show>
			</Tabs>

		</Dialog>
	);
};
