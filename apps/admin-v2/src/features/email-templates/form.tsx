import { Show, createSignal } from 'solid-js';
import type { AuthorableEmailTemplateKind, CreateEmailTemplateCommand } from './contracts';
import { visibleError } from '~/ui/visible-error';

export function emailTemplateKindLabel(kind: 'tx' | 'campaign' | 'campaign_visual'): string {
	if (kind === 'tx') return 'Transactional';
	if (kind === 'campaign') return 'Campaign / HTML';
	return 'Campaign / Visual';
}

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
	const [name, setName] = createSignal(props.initial?.name ?? '');
	const [kind, setKind] = createSignal<AuthorableEmailTemplateKind>(props.initial?.kind ?? 'tx');
	const [subject, setSubject] = createSignal(props.initial?.subject ?? '');
	const [body, setBody] = createSignal(props.initial?.body ?? '');
	const [previewHtml, setPreviewHtml] = createSignal('');
	const [previewPending, setPreviewPending] = createSignal(false);
	const [previewError, setPreviewError] = createSignal('');
	let previewGeneration = 0;

	function values(): EmailTemplateFormValues {
		return {
			name: name(),
			kind: kind(),
			subject: kind() === 'tx' ? subject() : '',
			body: body(),
		};
	}

	function invalidatePreview(): void {
		previewGeneration += 1;
		setPreviewHtml('');
		setPreviewError('');
		setPreviewPending(false);
	}

	async function preview(): Promise<void> {
		const generation = ++previewGeneration;
		setPreviewPending(true);
		setPreviewError('');
		try {
			const current = values();
			const html = await props.onPreview({ kind: current.kind, body: current.body });
			if (generation === previewGeneration) setPreviewHtml(html);
		} catch (error) {
			if (generation === previewGeneration) {
				setPreviewHtml('');
				setPreviewError(visibleError(error, 'The template preview could not be rendered.'));
			}
		} finally {
			if (generation === previewGeneration) setPreviewPending(false);
		}
	}

	return (
		<form
			class="email-template-form"
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
						invalidatePreview();
					}}
					disabled={props.mode === 'edit' || props.pending}
				>
					<option value="tx">Transactional</option>
					<option value="campaign">Campaign / HTML</option>
				</select>
				<Show when={props.mode === 'edit'}><small>Template type cannot be changed.</small></Show>
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
						invalidatePreview();
					}}
					rows="18"
					maxlength={5_000_000}
					required
					disabled={props.pending}
					spellcheck={false}
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
					onClick={() => void preview()}
					disabled={props.pending || previewPending() || body() === ''}
					aria-busy={previewPending() ? 'true' : undefined}
				>
					{previewPending() ? 'Rendering…' : 'Render preview'}
				</button>
				<Show when={previewHtml()}>
					<button type="button" class="button button--secondary" onClick={() => setPreviewHtml('')}>Close preview</button>
				</Show>
			</div>
			<Show when={previewError()}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<Show when={previewHtml()}>
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
