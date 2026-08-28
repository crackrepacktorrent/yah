import { Show, createSignal, untrack } from 'solid-js';
import type { AuthorableMailingListKind, MailingListOptIn, MailingListStatus } from './contracts';

export type MailingListFormValues = {
	name: string;
	kind: AuthorableMailingListKind;
	optIn: MailingListOptIn;
	status: MailingListStatus;
	description: string;
};

export function mailingListKindLabel(kind: 'public' | 'private' | 'temporary'): string {
	if (kind === 'public') return 'Public';
	if (kind === 'private') return 'Private';
	return 'Temporary';
}

export function mailingListStatusLabel(status: MailingListStatus): string {
	return status === 'active' ? 'Active' : 'Archived';
}

export function MailingListForm(props: {
	mode: 'create' | 'edit';
	initial?: MailingListFormValues;
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (values: MailingListFormValues) => void;
}) {
	const initial = untrack(() => props.initial);
	const [name, setName] = createSignal(initial?.name ?? '');
	const [kind, setKind] = createSignal<AuthorableMailingListKind>(initial?.kind ?? 'private');
	const [optIn, setOptIn] = createSignal<MailingListOptIn>(initial?.optIn ?? 'double');
	const [status, setStatus] = createSignal<MailingListStatus>(initial?.status ?? 'active');
	const [description, setDescription] = createSignal(initial?.description ?? '');

	return (
		<form
			class="mailing-list-form"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit({ name: name(), kind: kind(), optIn: optIn(), status: status(), description: description() });
			}}
		>
			<Show when={props.error}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<label class="form-field form-field--wide">
				<span>Name <span aria-hidden="true">*</span></span>
				<input name="name" value={name()} onInput={(event) => setName(event.currentTarget.value)} maxlength={255} required disabled={props.pending} />
			</label>
			<label class="form-field">
				<span>Visibility</span>
				<select name="kind" value={kind()} onChange={(event) => setKind(event.currentTarget.value as AuthorableMailingListKind)} disabled={props.pending}>
					<option value="private">Private</option>
					<option value="public">Public</option>
				</select>
				<small>Public lists appear on the web subscription page. New lists default to private.</small>
			</label>
			<label class="form-field">
				<span>Opt-in</span>
				<select name="optIn" value={optIn()} onChange={(event) => setOptIn(event.currentTarget.value as MailingListOptIn)} disabled={props.pending}>
					<option value="double">Double opt-in</option>
					<option value="single">Single opt-in</option>
				</select>
				<small>Double opt-in confirms ownership before campaign delivery and is the safer default.</small>
			</label>
			<Show when={props.mode === 'edit'}>
				<label class="form-field">
					<span>Status</span>
					<select name="status" value={status()} onChange={(event) => setStatus(event.currentTarget.value as MailingListStatus)} disabled={props.pending}>
						<option value="active">Active</option>
						<option value="archived">Archived</option>
					</select>
					<small>Archived lists are not exposed by Listmonk's public catalog.</small>
				</label>
			</Show>
			<label class="form-field form-field--wide">
				<span>Description</span>
				<textarea name="description" value={description()} onInput={(event) => setDescription(event.currentTarget.value)} rows="5" maxlength={10_000} disabled={props.pending} />
				<Show when={props.mode === 'edit' && initial?.description}>
					<small>Listmonk 6 can replace this description but cannot clear it to empty.</small>
				</Show>
			</label>
			<div class="form-actions form-field--wide">
				<a class="button button--secondary" href={props.cancelHref}>Cancel</a>
				<button class="button" type="submit" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>
					{props.pending ? 'Saving…' : props.mode === 'create' ? 'Create list' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}
