import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import type { MailingList } from '~/features/mailing-lists/contracts';
import type { SubscriberMembershipState, SubscriberProfile, SubscriberStatus } from './contracts';

export type SubscriberCreateFormValues = {
	email: string;
	name: string;
	status: 'enabled' | 'disabled';
	listIds: number[];
	preconfirmSubscriptions: boolean;
};

export type SubscriberProfileFormValues = {
	email: string;
	name: string;
	status: SubscriberStatus;
};

export function subscriberStatusLabel(status: SubscriberStatus): string {
	if (status === 'enabled') return 'Enabled';
	if (status === 'disabled') return 'Disabled';
	return 'Blocklisted';
}

function toggleId(current: number[], id: number, selected: boolean): number[] {
	if (!selected) return current.filter((currentId) => currentId !== id);
	return current.includes(id) ? current : [...current, id];
}

export function SubscriberCreateForm(props: {
	lists: MailingList[];
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (values: SubscriberCreateFormValues) => void;
}) {
	const [email, setEmail] = createSignal('');
	const [name, setName] = createSignal('');
	const [status, setStatus] = createSignal<'enabled' | 'disabled'>('enabled');
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	const [preconfirmSubscriptions, setPreconfirmSubscriptions] = createSignal(false);
	const selectableLists = createMemo(() => props.lists.filter((list) => list.status === 'active' && list.kind !== 'temporary'));
	const disabledWithPendingDoubleOptIn = createMemo(() =>
		status() === 'disabled' &&
		!preconfirmSubscriptions() &&
		selectableLists().some((list) => list.optIn === 'double' && selectedIds().includes(list.id)),
	);

	return (
		<form class="subscriber-form" onSubmit={(event) => {
			event.preventDefault();
			if (disabledWithPendingDoubleOptIn()) return;
			props.onSubmit({ email: email(), name: name(), status: status(), listIds: selectedIds(), preconfirmSubscriptions: preconfirmSubscriptions() });
		}}>
			<Show when={props.error}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<label class="form-field">
				<span>Email <span aria-hidden="true">*</span></span>
				<input type="email" name="email" value={email()} onInput={(event) => setEmail(event.currentTarget.value)} maxlength={254} autocomplete="off" required disabled={props.pending} />
			</label>
			<label class="form-field">
				<span>Name</span>
				<input name="name" value={name()} onInput={(event) => setName(event.currentTarget.value)} maxlength={2_000} disabled={props.pending} />
				<small>Listmonk derives a name from the email address when this is blank.</small>
			</label>
			<label class="form-field">
				<span>Status</span>
				<select name="status" value={status()} onChange={(event) => setStatus(event.currentTarget.value as 'enabled' | 'disabled')} disabled={props.pending}>
					<option value="enabled">Enabled</option>
					<option value="disabled">Disabled</option>
				</select>
				<small>Blocklisting is a separate destructive action and is never available in this form.</small>
			</label>
			<fieldset class="subscriber-membership-fieldset form-field--wide" disabled={props.pending}>
				<legend>Initial mailing-list memberships</legend>
				<Show when={selectableLists().length > 0} fallback={<p>No active authorable mailing lists are available.</p>}>
					<For each={selectableLists()}>{(list) => (
						<label>
							<input type="checkbox" name="listId" value={list.id} checked={selectedIds().includes(list.id)} onChange={(event) => setSelectedIds((current) => toggleId(current, list.id, event.currentTarget.checked))} />
							<span>{list.name}</span><small>{list.optIn === 'double' ? 'Double opt-in' : 'Single opt-in'} · {list.kind}</small>
						</label>
					)}</For>
				</Show>
			</fieldset>
			<label class="subscriber-confirm-field form-field--wide">
				<input type="checkbox" name="preconfirmSubscriptions" checked={preconfirmSubscriptions()} onChange={(event) => setPreconfirmSubscriptions(event.currentTarget.checked)} disabled={props.pending || selectedIds().length === 0} />
				<span>Confirm selected memberships immediately</span>
				<small>This skips double opt-in and sends no confirmation request. When left off, single opt-in memberships are confirmed and double opt-in memberships remain unconfirmed.</small>
			</label>
			<Show when={disabledWithPendingDoubleOptIn()}><p class="field-error form-field--wide" role="alert">A disabled subscriber cannot complete double opt-in. Confirm those memberships immediately or choose Enabled.</p></Show>
			<div class="form-actions form-field--wide">
				<a class="button button--secondary" href={props.cancelHref}>Cancel</a>
				<button class="button" type="submit" disabled={props.pending || disabledWithPendingDoubleOptIn()} aria-busy={props.pending ? 'true' : undefined}>{props.pending ? 'Creating…' : 'Create subscriber'}</button>
			</div>
		</form>
	);
}

export function SubscriberProfileForm(props: {
	subscriber: SubscriberProfile;
	pending: boolean;
	error: string;
	onSubmit: (values: SubscriberProfileFormValues) => void;
}) {
	const [email, setEmail] = createSignal('');
	const [name, setName] = createSignal('');
	const [status, setStatus] = createSignal<SubscriberStatus>('enabled');
	createEffect(
		() => props.subscriber,
		(subscriber) => {
			setEmail(subscriber.email);
			setName(subscriber.name);
			setStatus(subscriber.status);
		},
	);

	return (
		<form class="subscriber-form subscriber-form--profile" onSubmit={(event) => {
			event.preventDefault();
			props.onSubmit({ email: email(), name: name(), status: status() });
		}}>
			<Show when={props.error}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<label class="form-field">
				<span>Email <span aria-hidden="true">*</span></span>
				<input type="email" name="email" value={email()} onInput={(event) => setEmail(event.currentTarget.value)} maxlength={254} required disabled={props.pending} />
			</label>
			<label class="form-field">
				<span>Name</span>
				<input name="name" value={name()} onInput={(event) => setName(event.currentTarget.value)} maxlength={2_000} disabled={props.pending} />
				<Show when={props.subscriber.name !== ''}><small>Listmonk 6 cannot clear an existing name; replace it instead.</small></Show>
			</label>
			<label class="form-field">
				<span>Status</span>
				<Show when={props.subscriber.status !== 'blocklisted'} fallback={<input value="Blocklisted" disabled />}>
					<select name="status" value={status()} onChange={(event) => setStatus(event.currentTarget.value as 'enabled' | 'disabled')} disabled={props.pending}>
						<option value="enabled">Enabled</option>
						<option value="disabled">Disabled</option>
					</select>
				</Show>
				<small>{props.subscriber.status === 'blocklisted' ? 'Restoring requires a separate recovery workflow because blocklisting unsubscribes every membership.' : 'Blocklisting is available only as a separate destructive action.'}</small>
			</label>
			<div class="form-actions form-field--wide"><button class="button" type="submit" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>{props.pending ? 'Saving…' : 'Save profile'}</button></div>
		</form>
	);
}

function membershipIsProtected(membership: SubscriberMembershipState['memberships'][number]): boolean {
	return membership.restricted || membership.kind === 'temporary' || membership.listStatus === 'archived' || membership.status === 'unsubscribed';
}

export function SubscriberMembershipForm(props: {
	subscriber: SubscriberMembershipState;
	lists: MailingList[];
	pending: boolean;
	error: string;
	onSubmit: (listIds: number[]) => void;
}) {
	const currentById = createMemo(() => new Map(props.subscriber.memberships.map((membership) => [membership.id, membership])));
	const editableLists = createMemo(() => props.lists.filter((list) => {
		const membership = currentById().get(list.id);
		return (list.status === 'active' && list.kind !== 'temporary' && (!membership || !membershipIsProtected(membership)));
	}));
	const protectedMemberships = createMemo(() => props.subscriber.memberships.filter(membershipIsProtected));
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	createEffect(
		() => props.subscriber,
		(subscriber) => {
			setSelectedIds(
				subscriber.memberships.filter((membership) => !membershipIsProtected(membership)).map(({ id }) => id),
			);
		},
	);

	return (
		<form class="subscriber-membership-form" onSubmit={(event) => { event.preventDefault(); props.onSubmit(selectedIds()); }}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="subscriber-membership-fieldset" disabled={props.pending}>
				<legend>Authorable memberships</legend>
				<p>Unchecking an existing membership unsubscribes it while preserving its consent history. Double opt-in additions remain unconfirmed until the recipient confirms; Request confirmation asks Listmonk to send the email.</p>
				<Show when={editableLists().length > 0} fallback={<p>No active authorable mailing lists are available.</p>}>
					<For each={editableLists()}>{(list) => (
						<label>
							<input type="checkbox" name="listId" value={list.id} checked={selectedIds().includes(list.id)} onChange={(event) => setSelectedIds((current) => toggleId(current, list.id, event.currentTarget.checked))} />
							<span>{list.name}</span><small>{list.optIn === 'double' ? 'Double opt-in' : 'Single opt-in'} · {currentById().get(list.id)?.status ?? 'Not a member'}</small>
						</label>
					)}</For>
				</Show>
			</fieldset>
			<Show when={protectedMemberships().length > 0}>
				<section class="subscriber-protected-memberships" aria-labelledby="protected-memberships-heading">
					<h3 id="protected-memberships-heading">Provider- or consent-protected memberships</h3>
					<p>These memberships are preserved and cannot be changed by ordinary editing.</p>
					<ul><For each={protectedMemberships()}>{(membership) => <li><strong>{membership.name}</strong><span>{membership.status} · {membership.kind} · {membership.listStatus}{membership.restricted ? ' · restricted' : ''}</span></li>}</For></ul>
				</section>
			</Show>
			<div class="form-actions"><button class="button" type="submit" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>{props.pending ? 'Saving…' : 'Save memberships'}</button></div>
		</form>
	);
}
