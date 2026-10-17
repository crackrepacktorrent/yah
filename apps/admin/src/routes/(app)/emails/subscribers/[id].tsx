import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Errored, For, Loading, Show, createMemo, createSignal } from 'solid-js';
import { listSubscriberBounces } from '~/features/bounces/server';
import { CampaignTestSendPanel } from '~/features/campaign-test-sends/panel';
import { SubscriberBounceHistory } from '~/features/bounces/subscriber-history';
import { SubscriberActivityView } from '~/features/subscribers/activity';
import { listCampaigns } from '~/features/campaigns/server';
import { listMailingLists } from '~/features/mailing-lists/server';
import type { SubscriberMembershipState, SubscriberProfile } from '~/features/subscribers/contracts';
import { SubscriberMembershipForm, SubscriberProfileForm, type SubscriberProfileFormValues } from '~/features/subscribers/form';
import { subscriberStatusLabel } from '~/features/subscribers/presentation';
import { decodeSubscriberRouteId } from '~/features/subscribers/routing';
import { blocklistSubscribers, deleteSubscribers, getSubscriber, getSubscriberActivity, getSubscriberMemberships, listSubscribers, requestSubscriberOptIn, updateSubscriberMemberships, updateSubscriberProfile } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { PageHeader } from '~/ui/page-header';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import { createPublicError } from '~/platform/errors';

export const route = defineFileRoute('/emails/subscribers/:id', {
	matchFilters: { id: (segment) => decodeSubscriberRouteId(segment) > 0 },
	preload: ({ params }) => void getSubscriber(decodeSubscriberRouteId(params.id)),
});

export default function SubscriberDetailPage(props: RouteProps<typeof route>) {
	const subscriberId = createMemo(() => decodeSubscriberRouteId(props.params.id));
	return <Show when={subscriberId()} keyed>{(resolved) => <SubscriberRoute subscriberId={resolved} />}</Show>;
}

function SubscriberRoute(props: { subscriberId: number }) {
	const subscriber = createMemo(() => getSubscriber(props.subscriberId));
	return <Show when={subscriber()}>{(resolved) => <SubscriberDetailView subscriber={resolved()} />}</Show>;
}

function SubscriberDetailView(props: { subscriber: SubscriberProfile }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'subscriber', 'edit'));
	const canDelete = createMemo(() => can(session(), 'subscriber', 'delete'));
	const canBlocklist = createMemo(() => can(session(), 'subscriber', 'blocklist') && props.subscriber.status !== 'blocklisted');
	const canViewLists = createMemo(() => can(session(), 'list', 'view'));
	const canViewCampaigns = createMemo(() => can(session(), 'campaign', 'view'));
	const canSendCampaignTests = createMemo(() => canViewCampaigns() && can(session(), 'campaign', 'send') && props.subscriber.status === 'enabled');
	const canViewBounces = createMemo(() => can(session(), 'bounce', 'view'));
	const canClearBounces = createMemo(() => can(session(), 'bounce', 'delete'));
	const canEditMemberships = createMemo(() => canEdit() && canViewLists() && props.subscriber.status !== 'blocklisted');
	const lists = createMemo(() => canViewLists() ? listMailingLists() : []);
	const membershipState = createMemo(() => canViewLists() ? getSubscriberMemberships(props.subscriber.id) : null);
	const profileTask = createCommandTask();
	const [profileResetVersion, setProfileResetVersion] = createSignal(0);
	const membershipsTask = createCommandTask();
	const [membershipsResetVersion, setMembershipsResetVersion] = createSignal(0);
	const [activityOpen, setActivityOpen] = createSignal(false);
	const [testSendOpen, setTestSendOpen] = createSignal(false);
	const [bouncesOpen, setBouncesOpen] = createSignal(false);
	const [dialog, setDialog] = createSignal<'delete' | 'blocklist' | 'optin' | null>(null);
	const actionTask = createCommandTask();

	async function refresh(id: number, includeMemberships: boolean): Promise<void> {
		const keys = [getSubscriber.keyFor(id), listSubscribers.key];
		if (includeMemberships) keys.push(getSubscriberMemberships.keyFor(id));
		revalidate(keys);
		await Promise.all([
			getSubscriber(id),
			...(includeMemberships ? [getSubscriberMemberships(id)] : []),
		]);
	}

	async function saveProfile(values: SubscriberProfileFormValues): Promise<void> {
		const subscriber = props.subscriber;
		const includeMemberships = canViewLists();
		await profileTask.run(async () => {
			await updateSubscriberProfile({ id: subscriber.id, expectedUpdatedAt: subscriber.updatedAt, ...values });
			try {
				await refresh(subscriber.id, includeMemberships);
			} catch {
				throw createPublicError('The subscriber profile was saved, but its latest provider state could not be reloaded. Reload this page before editing again.', 503);
			}
			setProfileResetVersion((version) => version + 1);
			toast.success('Subscriber profile updated.');
		}, 'The subscriber profile could not be updated.');
	}

	async function saveMemberships(listIds: number[]): Promise<void> {
		const current = membershipState();
		if (!current) return;
		const subscriber = props.subscriber;
		const includeMemberships = canViewLists();
		await membershipsTask.run(async () => {
			await updateSubscriberMemberships({
				id: subscriber.id,
				expectedUpdatedAt: subscriber.updatedAt,
				expectedMembershipVersion: current.membershipVersion,
				listIds,
			});
			try {
				await refresh(subscriber.id, includeMemberships);
			} catch {
				throw createPublicError('The memberships were saved, but their latest provider state could not be reloaded. Reload this page before editing again.', 503);
			}
			setMembershipsResetVersion((version) => version + 1);
			toast.success('Subscriber memberships updated.');
		}, 'The subscriber memberships could not be updated.');
	}

	function openDialog(next: 'delete' | 'blocklist' | 'optin'): void {
		actionTask.clearError();
		setDialog(next);
	}

	async function performAction(): Promise<void> {
		const operation = dialog();
		if (!operation) return;
		const version = { id: props.subscriber.id, expectedUpdatedAt: props.subscriber.updatedAt };
		const current = operation === 'optin' ? membershipState() : null;
		const includeMemberships = canViewLists();
		await actionTask.run(async () => {
			if (operation === 'delete') {
				await deleteSubscribers({ subscribers: [version] });
				revalidate(listSubscribers.key);
				setDialog(null);
				toast.success('Subscriber deleted.');
				navigate('/emails/subscribers');
				return;
			}
			if (operation === 'blocklist') await blocklistSubscribers({ subscribers: [version] });
			else {
				if (!current) throw new Error('Subscriber memberships are unavailable.');
				await requestSubscriberOptIn({ ...version, expectedMembershipVersion: current.membershipVersion });
			}
			try {
				await refresh(version.id, includeMemberships);
			} catch {
				setDialog(null);
				toast.error(`The subscriber was ${operation === 'blocklist' ? 'blocklisted' : 'sent an opt-in request'}, but its latest provider state could not be reloaded. Reload this page before another change.`);
				return;
			}
			setDialog(null);
			toast.success(operation === 'blocklist' ? 'Subscriber blocklisted.' : 'Opt-in request accepted.');
		}, operation === 'optin' ? 'The opt-in request was not accepted.' : `The subscriber could not be ${operation === 'blocklist' ? 'blocklisted' : 'deleted'}.`);
	}

	return (
		<section class="subscribers-page">
			<Breadcrumbs items={[{ href: '/emails/subscribers', label: 'Subscribers' }, { label: props.subscriber.email }]} />
			<PageHeader
				title={props.subscriber.name || props.subscriber.email}
				description={<>{props.subscriber.email} · <span class={`badge subscriber-status subscriber-status--${props.subscriber.status}`}>{subscriberStatusLabel(props.subscriber.status)}</span></>}
			>
				<div class="subscriber-detail-actions">
					<Show when={canBlocklist()}><button class="button button--danger-secondary" type="button" onClick={() => openDialog('blocklist')}>Blocklist</button></Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => openDialog('delete')}>Delete</button></Show>
				</div>
			</PageHeader>

			<section class="subscriber-section" aria-labelledby="subscriber-profile-heading">
				<h2 id="subscriber-profile-heading">Profile</h2>
				<Show when={canEdit()} fallback={<ReadOnlyProfile subscriber={props.subscriber} />}>
					<SubscriberProfileForm subscriber={props.subscriber} resetVersion={profileResetVersion()} pending={profileTask.pending()} error={profileTask.error()} onSubmit={(values) => void saveProfile(values)} />
				</Show>
			</section>

			<Show when={canViewLists()}>
				<section class="subscriber-section" aria-labelledby="subscriber-memberships-heading">
					<h2 id="subscriber-memberships-heading">Mailing-list memberships</h2>
					<Errored fallback={(_error, reset) => <SubscriberSectionError title="Memberships unavailable" retry={() => { revalidate(getSubscriberMemberships.keyFor(props.subscriber.id), true); reset(); }} />}>
						<Loading fallback={<p role="status">Loading subscriber memberships…</p>}>
							<Show when={membershipState()}>{(current) => <><Show when={canEdit() && current().canRequestOptIn}><div class="subscriber-detail-actions"><button class="button button--secondary" type="button" onClick={() => openDialog('optin')}>Request confirmation</button></div></Show><Show when={canEditMemberships()} fallback={<ReadOnlyMemberships subscriber={current()} />}><SubscriberMembershipForm subscriber={current()} lists={lists()} resetVersion={membershipsResetVersion()} pending={membershipsTask.pending()} error={membershipsTask.error()} onSubmit={(ids) => void saveMemberships(ids)} /></Show></>}</Show>
						</Loading>
					</Errored>
				</section>
			</Show>

			<Show when={canSendCampaignTests()}><section class="subscriber-section" aria-labelledby="subscriber-test-send-heading">
				<div class="subscriber-section-header"><div><h2 id="subscriber-test-send-heading">Send campaign test</h2><p>Queue one saved draft for this exact subscriber. Campaigns load only when requested.</p></div><button class="button button--secondary" type="button" aria-expanded={testSendOpen() ? 'true' : 'false'} onClick={() => setTestSendOpen((open) => !open)}>{testSendOpen() ? 'Hide campaign picker' : 'Choose campaign'}</button></div>
				<Show when={testSendOpen()}><Errored fallback={(_error, reset) => <SubscriberSectionError title="Campaigns unavailable" retry={() => { revalidate(listCampaigns.key, true); reset(); }} />}><Loading fallback={<p role="status">Loading draft campaigns…</p>}><CampaignTestSendPanel subscriber={props.subscriber} /></Loading></Errored></Show>
			</section></Show>

			<Show when={canViewCampaigns()}><section class="subscriber-section" aria-labelledby="subscriber-activity-heading">
				<div class="subscriber-section-header"><div><h2 id="subscriber-activity-heading">Activity</h2><p>Loaded from Listmonk only when requested.</p></div><Show when={!activityOpen()}><button class="button button--secondary" type="button" onClick={() => setActivityOpen(true)}>Load activity</button></Show></div>
				<Show when={activityOpen()}><Errored fallback={(_error, reset) => <SubscriberSectionError title="Activity unavailable" retry={() => { revalidate(getSubscriberActivity.keyFor(props.subscriber.id), true); reset(); }} />}><Loading fallback={<p role="status">Loading subscriber activity…</p>}><SubscriberActivityView subscriberId={props.subscriber.id} /></Loading></Errored></Show>
			</section></Show>

			<Show when={canViewBounces()}><section class="subscriber-section" aria-labelledby="subscriber-bounces-heading">
				<div class="subscriber-section-header"><div><h2 id="subscriber-bounces-heading">Bounce history</h2><p>Loaded from Listmonk only when requested. Clearing records does not restore subscriber or membership state.</p></div><Show when={!bouncesOpen()}><button class="button button--secondary" type="button" onClick={() => setBouncesOpen(true)}>Load bounce history</button></Show></div>
				<Show when={bouncesOpen()}><Errored fallback={(_error, reset) => <SubscriberSectionError title="Bounce history unavailable" retry={() => { revalidate(listSubscriberBounces.keyFor(props.subscriber.id), true); reset(); }} />}><Loading fallback={<p role="status">Loading subscriber bounce history…</p>}><SubscriberBounceHistory subscriberId={props.subscriber.id} email={props.subscriber.email} canClear={canClearBounces()} /></Loading></Errored></Show>
			</section></Show>

			<ConfirmDialog open={dialog() === 'optin'} title="Request confirmation?" description="Ask Listmonk to process a confirmation request for the eligible unconfirmed double opt-in memberships. Acceptance does not prove that email delivery completed." confirmLabel="Request confirmation" confirmTone="primary" pending={actionTask.pending()} error={actionTask.error()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'blocklist'} title="Blocklist subscriber?" description={`Blocklist ${props.subscriber.email}? Listmonk will unsubscribe every membership. Restoring the identity and its memberships requires a separate recovery workflow.`} confirmLabel="Blocklist subscriber" pending={actionTask.pending()} error={actionTask.error()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'delete'} title="Delete subscriber?" description={`Permanently delete ${props.subscriber.email} and their Listmonk history? This cannot be undone.`} confirmLabel="Delete subscriber" pending={actionTask.pending()} error={actionTask.error()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
		</section>
	);
}

function ReadOnlyProfile(props: { subscriber: SubscriberProfile }) {
	return <dl class="subscriber-metadata metadata-list"><div><dt>Email</dt><dd>{props.subscriber.email}</dd></div><div><dt>Name</dt><dd>{props.subscriber.name || 'None'}</dd></div><div><dt>Status</dt><dd>{subscriberStatusLabel(props.subscriber.status)}</dd></div><div><dt>Created</dt><dd>{new Date(props.subscriber.createdAt).toLocaleString()}</dd></div><div><dt>Updated</dt><dd>{new Date(props.subscriber.updatedAt).toLocaleString()}</dd></div><div><dt>Provider UUID</dt><dd>{props.subscriber.uuid}</dd></div><div class="subscriber-attributes"><dt>Attributes</dt><dd><pre><code>{JSON.stringify(props.subscriber.attributes, null, 2)}</code></pre></dd></div></dl>;
}

function ReadOnlyMemberships(props: { subscriber: SubscriberMembershipState }) {
	return <Show when={props.subscriber.memberships.length > 0} fallback={<p>No mailing-list memberships.</p>}><ul class="subscriber-membership-list"><For each={props.subscriber.memberships}>{(membership) => <li><strong>{membership.name}</strong><span>{membership.status} · {membership.kind} · {membership.listStatus}{membership.restricted ? ' · restricted' : ''}</span></li>}</For></ul></Show>;
}

function SubscriberSectionError(props: { title: string; retry: () => void }) {
	return <div class="subscriber-section-error" role="alert"><strong>{props.title}</strong><button class="button button--secondary" type="button" onClick={() => props.retry()}>Try again</button></div>;
}
