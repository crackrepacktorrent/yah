import { Show, createSignal, untrack } from 'solid-js';
import type { AuthorableEmailTemplateKind, CreateEmailTemplateCommand } from './contracts';
import { createPreviewTask } from '~/ui/preview-task';

export type EmailTemplateFormValues = CreateEmailTemplateCommand;

export function EmailTemplateForm(props: {
	mode: 'create' | 'edit';
	initial?: EmailTemplateFormValues;
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (values: EmailTemplateFormValues) => void;
	onPreview: (values: Pick<EmailTemplateFormValues, 'kind' | 'body'>) => Promise<string>;
}) {
	const initial = untrack(() => props.initial);
	const [name, setName] = createSignal(initial?.name ?? '');
	const [kind, setKind] = createSignal<AuthorableEmailTemplateKind>(initial?.kind ?? 'tx');
	const [subject, setSubject] = createSignal(initial?.subject ?? '');
	const [body, setBody] = createSignal(initial?.body ?? '');
	const preview = createPreviewTask();

	function values(): EmailTemplateFormValues {
		return {
			name: name(),
			kind: kind(),
			subject: kind() === 'tx' ? subject() : '',
			body: body(),
		};
	}

	return (
		<form
			class="email-template-form form-grid"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit(values());
			}}
		>
			<Show when={props.error}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<label class="form-field">
				<span>Name <span aria-hidden="true">*</span></span>
				<input
					name="name"
					value={name()}
					onInput={(event) => setName(event.currentTarget.value)}
					maxlength={255}
					required
					disabled={props.pending}
				/>
			</label>
			<label class="form-field">
				<span>Type</span>
				<select
					name="kind"
					value={kind()}
					onChange={(event) => {
						setKind(event.currentTarget.value as AuthorableEmailTemplateKind);
						preview.clear();
					}}
					disabled={props.mode === 'edit' || props.pending}
				>
					<option value="tx">Transactional</option>
					<option value="campaign">Campaign / HTML</option>
				</select>
				<Show when={props.mode === 'edit'}>
					<small>Listmonk 6.2 cannot change an existing template's type. Create a new template instead.</small>
				</Show>
			</label>
			<Show when={kind() === 'tx'}>
				<label class="form-field form-field--wide">
					<span>Subject <span aria-hidden="true">*</span></span>
					<input
						name="subject"
						value={subject()}
						onInput={(event) => setSubject(event.currentTarget.value)}
						maxlength={1000}
						required
						disabled={props.pending}
					/>
					<small>Use expressions such as {'{{ .Tx.Data.access_link }}'} for transactional data.</small>
				</label>
			</Show>
			<label class="form-field form-field--wide">
				<span>Body (HTML) <span aria-hidden="true">*</span></span>
				<textarea
					name="body"
					value={body()}
					onInput={(event) => {
						setBody(event.currentTarget.value);
						preview.clear();
					}}
					rows="18"
					maxlength={5_000_000}
					required
					disabled={props.pending}
					spellcheck="false"
				/>
				<small>
					{kind() === 'campaign'
						? <>Include {'{{ template "content" . }}'} exactly once.</>
						: <>Listmonk renders Go template expressions when the message is sent.</>}
				</small>
			</label>

			<div class="template-preview-actions form-field--wide">
				<button
					type="button"
					class="button button--secondary"
					onClick={() => {
						const render = props.onPreview;
						const input = { kind: kind(), body: body() };
						void preview.load(() => render(input), 'The template preview could not be rendered.');
					}}
					disabled={props.pending || preview.pending() || body() === ''}
					aria-busy={preview.pending() ? 'true' : undefined}
				>
					{preview.pending() ? 'Rendering…' : 'Render preview'}
				</button>
				<Show when={preview.html()}>
					<button type="button" class="button button--secondary" onClick={preview.clear}>Close preview</button>
				</Show>
			</div>
			<Show when={preview.error()}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<Show when={preview.html()}>
				{(html) => (
					<div class="template-preview form-field--wide">
						<h2>Rendered preview</h2>
					<iframe srcdoc={html()} sandbox="" referrerpolicy="no-referrer" title="Rendered email template preview" />
					</div>
				)}
			</Show>

			<div class="form-actions form-field--wide">
				<a class="button button--secondary" href={props.cancelHref}>Cancel</a>
				<button class="button" type="submit" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>
					{props.pending ? 'Saving…' : props.mode === 'create' ? 'Create template' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}
