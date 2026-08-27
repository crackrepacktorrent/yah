import { For, Show, createMemo, createSignal } from 'solid-js';
import type { EmailTemplateSummary } from '~/features/email-templates/contracts';
import type { MailingList } from '~/features/mailing-lists/contracts';
import { RichTextEditor } from '~/ui/rich-text-editor';
import type {
	AuthorableCampaignContentType,
	CampaignType,
	CreateCampaignCommand,
} from './contracts';

export type CampaignFormValues = CreateCampaignCommand;

export function toLocalCampaignDateTime(value: string | null): string {
	if (value === null) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
	if (value === '') return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function parseTags(value: string): string[] {
	return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

export function CampaignForm(props: {
	mode: 'create' | 'edit';
	initial?: CampaignFormValues;
	lists: MailingList[];
	templates: EmailTemplateSummary[];
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (values: CampaignFormValues) => void;
}) {
	const [type, setType] = createSignal<CampaignType>(props.initial?.type ?? 'regular');
	const [name, setName] = createSignal(props.initial?.name ?? '');
	const [subject, setSubject] = createSignal(props.initial?.subject ?? '');
	const [fromEmail, setFromEmail] = createSignal(props.initial?.fromEmail ?? '');
	const [selectedLists, setSelectedLists] = createSignal<number[]>(props.initial?.listIds ?? []);
	const [body, setBody] = createSignal(props.initial?.body ?? '');
	const [contentType, setContentType] = createSignal<AuthorableCampaignContentType>(props.initial?.contentType ?? 'richtext');
	const [templateId, setTemplateId] = createSignal<number | null>(props.initial?.templateId ?? null);
	const [tags, setTags] = createSignal((props.initial?.tags ?? []).join(', '));
	const [sendAt, setSendAt] = createSignal(toLocalCampaignDateTime(props.initial?.sendAt ?? null));
	const activeLists = createMemo(() => props.lists.filter((list) => list.status === 'active'));
	const selectableLists = createMemo(() => type() === 'optin' ? activeLists().filter((list) => list.optIn === 'double') : activeLists());
	const unavailableSelectedLists = createMemo(() => {
		const selectableIds = new Set(selectableLists().map((list) => list.id));
		return props.lists.filter((list) => selectedLists().includes(list.id) && !selectableIds.has(list.id));
	});
	const campaignTemplates = createMemo(() => props.templates.filter((template) => template.kind === 'campaign'));
	const initialTemplateMissingFromCatalog = createMemo(
		() => props.initial?.templateId != null && !campaignTemplates().some((template) => template.id === props.initial?.templateId),
	);

	function selectType(next: CampaignType): void {
		setType(next);
		if (next === 'optin') {
			const doubleIds = new Set(activeLists().filter((list) => list.optIn === 'double').map((list) => list.id));
			setSelectedLists((selected) => selected.filter((id) => doubleIds.has(id)));
		}
	}

	function toggleList(id: number, selected: boolean): void {
		setSelectedLists((current) => selected ? [...current, id] : current.filter((currentId) => currentId !== id));
	}

	function values(): CampaignFormValues {
		return {
			type: type(),
			name: name(),
			subject: subject(),
			fromEmail: fromEmail(),
			listIds: selectedLists(),
			body: type() === 'optin' ? '' : body(),
			contentType: type() === 'optin' ? 'richtext' : contentType(),
			templateId: templateId(),
			tags: parseTags(tags()),
			sendAt: toIsoDateTime(sendAt()),
		};
	}

	return (
		<form
			class="campaign-form"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit(values());
			}}
		>
			<Show when={props.error}>{(message) => <p class="field-error form-field--wide" role="alert">{message()}</p>}</Show>
			<Show when={props.mode === 'create'}>
				<fieldset class="campaign-type-fieldset form-field--wide" disabled={props.pending}>
					<legend>Campaign type</legend>
					<label><input type="radio" name="type" value="regular" checked={type() === 'regular'} onChange={() => selectType('regular')} /> Regular campaign</label>
					<label><input type="radio" name="type" value="optin" checked={type() === 'optin'} onChange={() => selectType('optin')} /> Confirmation campaign</label>
					<small>Confirmation campaigns durably resend opt-in messages only to unconfirmed subscribers on double opt-in lists.</small>
				</fieldset>
			</Show>
			<label class="form-field">
				<span>Name <span aria-hidden="true">*</span></span>
				<input name="name" value={name()} onInput={(event) => setName(event.currentTarget.value)} maxlength={255} required disabled={props.pending} />
			</label>
			<label class="form-field">
				<span>Subject <span aria-hidden="true">*</span></span>
				<input name="subject" value={subject()} onInput={(event) => setSubject(event.currentTarget.value)} maxlength={5_000} required disabled={props.pending} />
			</label>
			<label class="form-field">
				<span>From address</span>
				<input name="fromEmail" value={fromEmail()} onInput={(event) => setFromEmail(event.currentTarget.value)} maxlength={1_000} placeholder="Default from Listmonk settings" disabled={props.pending} />
				<small>Leave blank to use the configured default. A named address such as YAH &lt;hello@example.org&gt; is supported.</small>
			</label>
			<label class="form-field">
				<span>Scheduled time</span>
				<input name="sendAt" type="datetime-local" value={sendAt()} onInput={(event) => setSendAt(event.currentTarget.value)} disabled={props.pending} />
				<small>Saving keeps the campaign as a draft. Use Schedule from its detail page when it is ready.</small>
			</label>
				<fieldset class="campaign-list-fieldset form-field--wide" disabled={props.pending}>
					<legend>Mailing lists <span aria-hidden="true">*</span></legend>
					<For each={unavailableSelectedLists()}>{(list) => (
						<label>
							<input type="checkbox" name="listId" value={list.id} checked onChange={(event) => toggleList(list.id, event.currentTarget.checked)} />
							<span>{list.name}</span><small>{list.status === 'archived' ? 'Archived' : 'No longer double opt-in'} · Remove before saving</small>
						</label>
					)}</For>
					<Show when={selectableLists().length > 0} fallback={<p>No active {type() === 'optin' ? 'double opt-in ' : ''}mailing lists are available.</p>}>
					<For each={selectableLists()}>{(list) => (
						<label>
							<input type="checkbox" name="listId" value={list.id} checked={selectedLists().includes(list.id)} onChange={(event) => toggleList(list.id, event.currentTarget.checked)} />
							<span>{list.name}</span><small>{list.optIn === 'double' ? 'Double opt-in' : 'Single opt-in'} · {list.kind}</small>
						</label>
					)}</For>
				</Show>
			</fieldset>
			<label class="form-field">
				<span>Campaign template</span>
				<select name="templateId" value={templateId() === null ? '' : String(templateId())} onChange={(event) => setTemplateId(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} disabled={props.pending}>
					<option value="">Default campaign template</option>
					<Show when={initialTemplateMissingFromCatalog()}><option value={props.initial!.templateId!}>Current template #{props.initial!.templateId!}</option></Show>
					<For each={campaignTemplates()}>{(template) => <option value={template.id}>{template.name}</option>}</For>
				</select>
			</label>
			<label class="form-field">
				<span>Tags</span>
				<input name="tags" value={tags()} onInput={(event) => setTags(event.currentTarget.value)} placeholder="newsletter, monthly" disabled={props.pending} />
				<small>Separate tags with commas.</small>
			</label>

			<Show
				when={type() === 'regular'}
				fallback={<p class="campaign-optin-note form-field--wide">Listmonk generates and owns the confirmation message, including the correct opt-in URL for the selected lists.</p>}
			>
				<label class="form-field">
					<span>Content type</span>
					<select name="contentType" value={contentType()} onChange={(event) => setContentType(event.currentTarget.value as AuthorableCampaignContentType)} disabled={props.pending}>
						<option value="richtext">Rich text</option>
						<option value="html">HTML</option>
						<option value="markdown">Markdown</option>
						<option value="plain">Plain text</option>
					</select>
				</label>
				<div class="form-field form-field--wide">
					<span>Campaign content <span aria-hidden="true">*</span></span>
					<Show
						when={contentType() === 'richtext'}
						fallback={<textarea name="body" value={body()} onInput={(event) => setBody(event.currentTarget.value)} rows="18" maxlength={5_000_000} required disabled={props.pending} spellcheck={contentType() !== 'html'} />}
					>
						<RichTextEditor label="Campaign content" value={body()} onChange={setBody} disabled={props.pending} />
					</Show>
					<small>Subscriber fields such as {'{{ .Subscriber.Name }}'} are rendered by Listmonk.</small>
				</div>
			</Show>

			<div class="form-actions form-field--wide">
				<a class="button button--secondary" href={props.cancelHref}>Cancel</a>
				<button class="button" type="submit" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>
					{props.pending ? 'Saving…' : props.mode === 'create' ? 'Create draft' : 'Save draft'}
				</button>
			</div>
		</form>
	);
}
