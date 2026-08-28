import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Errored, For, Loading, Show, createMemo, createSignal } from 'solid-js';
import type { BounceSummary } from '~/features/bounces/contracts';
import { bounceTypeLabel } from '~/features/bounces/presentation';
import { clearSubscriberBounces, listSubscriberBounces } from '~/features/bounces/server';
import { sendCampaignTest } from '~/features/campaign-test-sends/server';
import type { CampaignSummary } from '~/features/campaigns/contracts';
import { listCampaigns } from '~/features/campaigns/server';
import { listMailingLists } from '~/features/mailing-lists/server';
import type { SubscriberActivity, SubscriberMembershipState, SubscriberProfile } from '~/features/subscribers/contracts';
import { SubscriberMembershipForm, SubscriberProfileForm, subscriberStatusLabel, type SubscriberProfileFormValues } from '~/features/subscribers/form';
import { safeActivityLinkHref } from '~/features/subscribers/presentation';
import { decodeSubscriberRouteId } from '~/features/subscribers/routing';
import { blocklistSubscribers, deleteSubscribers, getSubscriber, getSubscriberActivity, getSubscriberMemberships, listSubscribers, requestSubscriberOptIn, updateSubscriberMemberships, updateSubscriberProfile } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

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
	const canEdit = createMemo(() => session().permissions['subscriber']?.includes('edit') ?? false);
	const canDelete = createMemo(() => session().permissions['subscriber']?.includes('delete') ?? false);
	const canBlocklist = createMemo(() => (session().permissions['subscriber']?.includes('blocklist') ?? false) && props.subscriber.status !== 'blocklisted');
	const canViewLists = createMemo(() => session().permissions['list']?.includes('view') ?? false);
	const canViewCampaigns = createMemo(() => session().permissions['campaign']?.includes('view') ?? false);
	const canSendCampaignTests = createMemo(() => canViewCampaigns() && (session().permissions['campaign']?.includes('send') ?? false) && props.subscriber.status === 'enabled');
	const canViewBounces = createMemo(() => session().permissions['bounce']?.includes('view') ?? false);
	const canClearBounces = createMemo(() => session().permissions['bounce']?.includes('delete') ?? false);
	const canEditMemberships = createMemo(() => canEdit() && canViewLists() && props.subscriber.status !== 'blocklisted');
	const lists = createMemo(() => canViewLists() ? listMailingLists() : []);
	const membershipState = createMemo(() => canViewLists() ? getSubscriberMemberships(props.subscriber.id) : null);
	const [profilePending, setProfilePending] = createSignal(false);
	const [profileError, setProfileError] = createSignal('');
	const [profileResetVersion, setProfileResetVersion] = createSignal(0);
	const [membershipsPending, setMembershipsPending] = createSignal(false);
	const [membershipsError, setMembershipsError] = createSignal('');
	const [membershipsResetVersion, setMembershipsResetVersion] = createSignal(0);
	const [activityOpen, setActivityOpen] = createSignal(false);
	const [testSendOpen, setTestSendOpen] = createSignal(false);
	const [bouncesOpen, setBouncesOpen] = createSignal(false);
	const [dialog, setDialog] = createSignal<'delete' | 'blocklist' | 'optin' | null>(null);
	const [actionPending, setActionPending] = createSignal(false);
	const [actionError, setActionError] = createSignal('');

	async function refresh(): Promise<void> {
		const keys = [getSubscriber.keyFor(props.subscriber.id), listSubscribers.key];
		if (canViewLists()) keys.push(getSubscriberMemberships.keyFor(props.subscriber.id));
		revalidate(keys);
		await Promise.all([
			getSubscriber(props.subscriber.id),
			...(canViewLists() ? [getSubscriberMemberships(props.subscriber.id)] : []),
		]);
	}

	async function saveProfile(values: SubscriberProfileFormValues): Promise<void> {
		setProfileError('');
		setProfilePending(true);
		try {
			await updateSubscriberProfile({ id: props.subscriber.id, expectedUpdatedAt: props.subscriber.updatedAt, ...values });
			try {
				await refresh();
			} catch {
				setProfileError('The subscriber profile was saved, but its latest provider state could not be reloaded. Reload this page before editing again.');
				return;
			}
			setProfileResetVersion((version) => version + 1);
			toast.success('Subscriber profile updated.');
		} catch (caught) {
			setProfileError(visibleError(caught, 'The subscriber profile could not be updated.'));
		} finally {
			setProfilePending(false);
		}
	}

	async function saveMemberships(listIds: number[]): Promise<void> {
		const current = membershipState();
		if (!current) return;
		setMembershipsError('');
		setMembershipsPending(true);
		try {
			await updateSubscriberMemberships({
				id: props.subscriber.id,
				expectedUpdatedAt: props.subscriber.updatedAt,
				expectedMembershipVersion: current.membershipVersion,
				listIds,
			});
			try {
				await refresh();
			} catch {
				setMembershipsError('The memberships were saved, but their latest provider state could not be reloaded. Reload this page before editing again.');
				return;
			}
			setMembershipsResetVersion((version) => version + 1);
			toast.success('Subscriber memberships updated.');
		} catch (caught) {
			setMembershipsError(visibleError(caught, 'The subscriber memberships could not be updated.'));
		} finally {
			setMembershipsPending(false);
		}
	}

	function openDialog(next: 'delete' | 'blocklist' | 'optin'): void {
		setActionError('');
		setDialog(next);
	}

	async function performAction(): Promise<void> {
		const operation = dialog();
		if (!operation) return;
		setActionPending(true);
		setActionError('');
		try {
			const version = { id: props.subscriber.id, expectedUpdatedAt: props.subscriber.updatedAt };
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
				const current = membershipState();
				if (!current) throw new Error('Subscriber memberships are unavailable.');
				await requestSubscriberOptIn({ ...version, expectedMembershipVersion: current.membershipVersion });
			}
			try {
				await refresh();
			} catch {
				setDialog(null);
				toast.error(`The subscriber was ${operation === 'blocklist' ? 'blocklisted' : 'sent an opt-in request'}, but its latest provider state could not be reloaded. Reload this page before another change.`);
				return;
			}
			setDialog(null);
			toast.success(operation === 'blocklist' ? 'Subscriber blocklisted.' : 'Opt-in request accepted.');
		} catch (caught) {
			setActionError(visibleError(caught, operation === 'optin' ? 'The opt-in request was not accepted.' : `The subscriber could not be ${operation === 'blocklist' ? 'blocklisted' : 'deleted'}.`));
		} finally {
			setActionPending(false);
		}
	}

	return (
		<section class="subscribers-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/emails/subscribers">Subscribers</a><span aria-hidden="true">/</span><span>{props.subscriber.email}</span></nav>
			<header class="page-header">
				<div><h1>{props.subscriber.name || props.subscriber.email}</h1><p>{props.subscriber.email} · <span class={`subscriber-status subscriber-status--${props.subscriber.status}`}>{subscriberStatusLabel(props.subscriber.status)}</span></p></div>
				<div class="subscriber-detail-actions">
					<Show when={canBlocklist()}><button class="button button--danger-secondary" type="button" onClick={() => openDialog('blocklist')}>Blocklist</button></Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => openDialog('delete')}>Delete</button></Show>
				</div>
			</header>

			<section class="subscriber-section" aria-labelledby="subscriber-profile-heading">
				<h2 id="subscriber-profile-heading">Profile</h2>
				<Show when={canEdit()} fallback={<ReadOnlyProfile subscriber={props.subscriber} />}>
					<SubscriberProfileForm subscriber={props.subscriber} resetVersion={profileResetVersion()} pending={profilePending()} error={profileError()} onSubmit={(values) => void saveProfile(values)} />
				</Show>
			</section>

			<Show when={canViewLists()}>
				<section class="subscriber-section" aria-labelledby="subscriber-memberships-heading">
					<h2 id="subscriber-memberships-heading">Mailing-list memberships</h2>
					<Errored fallback={(_error, reset) => <SubscriberSectionError title="Memberships unavailable" retry={() => { revalidate(getSubscriberMemberships.keyFor(props.subscriber.id), true); reset(); }} />}>
						<Loading fallback={<p role="status">Loading subscriber memberships…</p>}>
							<Show when={membershipState()}>{(current) => <><Show when={canEdit() && current().canRequestOptIn}><div class="subscriber-detail-actions"><button class="button button--secondary" type="button" onClick={() => openDialog('optin')}>Request confirmation</button></div></Show><Show when={canEditMemberships()} fallback={<ReadOnlyMemberships subscriber={current()} />}><SubscriberMembershipForm subscriber={current()} lists={lists()} resetVersion={membershipsResetVersion()} pending={membershipsPending()} error={membershipsError()} onSubmit={(ids) => void saveMemberships(ids)} /></Show></>}</Show>
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

			<ConfirmDialog open={dialog() === 'optin'} title="Request confirmation?" description="Ask Listmonk to process a confirmation request for the eligible unconfirmed double opt-in memberships. Acceptance does not prove that email delivery completed." confirmLabel="Request confirmation" confirmTone="primary" pending={actionPending()} error={actionError()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'blocklist'} title="Blocklist subscriber?" description={`Blocklist ${props.subscriber.email}? Listmonk will unsubscribe every membership. Restoring the identity and its memberships requires a separate recovery workflow.`} confirmLabel="Blocklist subscriber" pending={actionPending()} error={actionError()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'delete'} title="Delete subscriber?" description={`Permanently delete ${props.subscriber.email} and their Listmonk history? This cannot be undone.`} confirmLabel="Delete subscriber" pending={actionPending()} error={actionError()} onConfirm={() => void performAction()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
		</section>
	);
}

function CampaignTestSendPanel(props: { subscriber: SubscriberProfile }) {
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
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const [accepted, setAccepted] = createSignal('');

	function requestSend(): void {
		if (!selectedCampaign()) return;
		setError('');
		setConfirmOpen(true);
	}

	async function performSend(): Promise<void> {
		const campaign = selectedCampaign();
		if (!campaign) return;
		setPending(true);
		setError('');
		setAccepted('');
		try {
			await sendCampaignTest({
				campaignId: campaign.id,
				expectedCampaignUpdatedAt: campaign.updatedAt,
				subscriberId: props.subscriber.id,
				expectedSubscriberUpdatedAt: props.subscriber.updatedAt,
			});
			setConfirmOpen(false);
			const message = `Test-send request accepted for ${props.subscriber.email}. Delivery is not confirmed.`;
			setAccepted(message);
		} catch (caught) {
			setError(visibleError(caught, 'The campaign test-send request could not be accepted.'));
		} finally {
			setPending(false);
		}
	}

	return <div class="campaign-test-send-panel">
		<p class="campaign-test-send-warning">This sends a real email with live subscriber-bound links. Opening it may add campaign views, clicks, or subscriber activity, and its unsubscribe link remains active.</p>
		<Show when={campaigns().length > 0} fallback={<p>No ordinary draft email campaigns are available.</p>}>
			<label class="campaign-test-send-field"><span>Draft campaign</span><select value={selectedId()} onChange={(event) => { setSelectedId(event.currentTarget.value); setAccepted(''); }}><option value="">Select a campaign</option><For each={campaigns()}>{(campaign: CampaignSummary) => <option value={campaign.id}>{campaign.name} — {campaign.subject}</option>}</For></select></label>
			<div class="subscriber-detail-actions"><button class="button" type="button" disabled={!selectedCampaign()} onClick={requestSend}>Review test email</button></div>
		</Show>
		<Show when={accepted()}>{(message) => <p class="campaign-test-send-accepted" role="status">{message()}</p>}</Show>
		<ConfirmDialog
			open={confirmOpen()}
			title="Send real test email?"
			description={selectedCampaign() ? `Ask Listmonk to queue ${selectedCampaign()!.name} for ${props.subscriber.email}. This is a real email with live links and tracking. Queue acceptance does not confirm delivery.` : ''}
			confirmLabel="Queue test email"
			confirmTone="primary"
			pending={pending()}
			error={error()}
			onConfirm={() => void performSend()}
			onOpenChange={(open) => { if (!open && !pending()) setConfirmOpen(false); }}
		/>
	</div>;
}

function ReadOnlyProfile(props: { subscriber: SubscriberProfile }) {
	return <dl class="subscriber-metadata"><div><dt>Email</dt><dd>{props.subscriber.email}</dd></div><div><dt>Name</dt><dd>{props.subscriber.name || 'None'}</dd></div><div><dt>Status</dt><dd>{subscriberStatusLabel(props.subscriber.status)}</dd></div><div><dt>Created</dt><dd>{new Date(props.subscriber.createdAt).toLocaleString()}</dd></div><div><dt>Updated</dt><dd>{new Date(props.subscriber.updatedAt).toLocaleString()}</dd></div><div><dt>Provider UUID</dt><dd>{props.subscriber.uuid}</dd></div><div class="subscriber-attributes"><dt>Attributes</dt><dd><pre><code>{JSON.stringify(props.subscriber.attributes, null, 2)}</code></pre></dd></div></dl>;
}

function ReadOnlyMemberships(props: { subscriber: SubscriberMembershipState }) {
	return <Show when={props.subscriber.memberships.length > 0} fallback={<p>No mailing-list memberships.</p>}><ul class="subscriber-membership-list"><For each={props.subscriber.memberships}>{(membership) => <li><strong>{membership.name}</strong><span>{membership.status} · {membership.kind} · {membership.listStatus}{membership.restricted ? ' · restricted' : ''}</span></li>}</For></ul></Show>;
}

function SubscriberActivityView(props: { subscriberId: number }) {
	const activity = createMemo(() => getSubscriberActivity(props.subscriberId));
	return <Show when={activity()}>{(resolved) => <ActivityResults activity={resolved()} />}</Show>;
}

function SubscriberBounceHistory(props: { subscriberId: number; email: string; canClear: boolean }) {
	const rows = createMemo(() => listSubscriberBounces(props.subscriberId));
	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function clearHistory(): Promise<void> {
		setPending(true);
		setError('');
		try {
			await clearSubscriberBounces(props.subscriberId);
			revalidate(listSubscriberBounces.keyFor(props.subscriberId));
			setConfirmOpen(false);
			toast.success('Subscriber bounce history cleared.');
		} catch (caught) {
			setError(visibleError(caught, 'The subscriber bounce history could not be cleared.'));
		} finally {
			setPending(false);
		}
	}

	return <Show when={rows()}>{(resolved) => <>
		<Show when={props.canClear && resolved().length > 0}><div class="subscriber-detail-actions"><button class="button button--danger-secondary" type="button" onClick={() => { setError(''); setConfirmOpen(true); }}>Clear subscriber bounce history</button></div></Show>
		<div class="data-table-scroll">
			<table class="data-table">
				<caption class="visually-hidden">Bounce history for {props.email}</caption>
				<thead><tr><th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
				<tbody><Show when={resolved().length > 0} fallback={<tr><td colspan="4">No bounce records for this subscriber.</td></tr>}><For each={resolved()}>{(bounce: BounceSummary) => <tr><td>{bounce.campaignName ?? '—'}</td><td><span class={`bounce-type bounce-type--${bounce.type}`}>{bounceTypeLabel(bounce.type)}</span></td><td>{bounce.source || '—'}</td><td>{new Date(bounce.createdAt).toLocaleString()}</td></tr>}</For></Show></tbody>
			</table>
		</div>
		<ConfirmDialog open={confirmOpen()} title="Clear subscriber bounce history?" description={`Permanently clear every bounce record for ${props.email}? This does not restore subscriber or membership state and cannot be undone.`} confirmLabel="Clear bounce history" pending={pending()} error={error()} onConfirm={() => void clearHistory()} onOpenChange={setConfirmOpen} />
	</>}</Show>;
}

function SubscriberSectionError(props: { title: string; retry: () => void }) {
	return <div class="subscriber-section-error" role="alert"><strong>{props.title}</strong><button class="button button--secondary" type="button" onClick={() => props.retry()}>Try again</button></div>;
}

function ActivityResults(props: { activity: SubscriberActivity }) {
	return (
		<div class="subscriber-activity-results">
			<section><h3>Campaign views</h3><Show when={props.activity.campaignViews.length > 0} fallback={<p>No campaign views.</p>}><ul><For each={props.activity.campaignViews}>{(view) => <li><strong>{view.campaignName || `Campaign ${view.campaignId}`}</strong><span>{view.viewCount.toLocaleString()} view{view.viewCount === 1 ? '' : 's'} · last {new Date(view.lastViewedAt).toLocaleString()}</span></li>}</For></ul></Show></section>
			<section><h3>Link clicks</h3><Show when={props.activity.linkClicks.length > 0} fallback={<p>No link clicks.</p>}><ul><For each={props.activity.linkClicks}>{(click) => <li><Show when={safeActivityLinkHref(click.url)} fallback={<span>{click.url}</span>}>{(href) => <a href={href()} target="_blank" rel="noreferrer">{click.url}</a>}</Show><span>{click.clickCount.toLocaleString()} click{click.clickCount === 1 ? '' : 's'} · last {new Date(click.lastClickedAt).toLocaleString()}{click.campaignName ? ` · ${click.campaignName}` : ''}</span></li>}</For></ul></Show></section>
		</div>
	);
}
