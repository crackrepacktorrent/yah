import { Show, createSignal } from 'solid-js';
import type { CreateShortlinkCommand } from './contracts';

export type ShortlinkFormValues = Omit<CreateShortlinkCommand, 'customSlug'> & { customSlug?: string };

export function toLocalDateTimeValue(value: string | undefined, timezoneOffsetMinutes?: number): string {
	if (!value) return '';
	const instant = new Date(value);
	if (Number.isNaN(instant.getTime())) return '';
	const offset = timezoneOffsetMinutes ?? instant.getTimezoneOffset();
	return new Date(instant.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function toShlinkDateTime(value: string, timezoneOffsetMinutes?: number): string {
	const instant = timezoneOffsetMinutes === undefined
		? new Date(value)
		: new Date(new Date(`${value}Z`).getTime() + timezoneOffsetMinutes * 60_000);
	if (Number.isNaN(instant.getTime())) return value;
	return instant.toISOString().replace(/Z$/, '+00:00');
}

export function ShortlinkForm(props: {
	mode: 'create' | 'edit';
	initial?: Partial<ShortlinkFormValues>;
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (values: ShortlinkFormValues) => void;
}) {
	const [longUrl, setLongUrl] = createSignal(props.initial?.longUrl ?? '');
	const [customSlug, setCustomSlug] = createSignal(props.initial?.customSlug ?? '');
	const [title, setTitle] = createSignal(props.initial?.title ?? '');
	const [tagText, setTagText] = createSignal((props.initial?.tags ?? []).join(', '));
	const [maxVisits, setMaxVisits] = createSignal(props.initial?.maxVisits?.toString() ?? '');
	const [validUntil, setValidUntil] = createSignal(toLocalDateTimeValue(props.initial?.validUntil));
	const [crawlable, setCrawlable] = createSignal(props.initial?.crawlable ?? false);
	const [forwardQuery, setForwardQuery] = createSignal(props.initial?.forwardQuery ?? true);

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		const expiry = validUntil();
		const slug = customSlug().trim();
		props.onSubmit({
			longUrl: longUrl(),
			...(props.mode === 'create' && slug ? { customSlug: slug } : {}),
			title: title(),
			tags: tagText()
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean),
			maxVisits: maxVisits() === '' ? null : Number(maxVisits()),
			...(expiry ? { validUntil: toShlinkDateTime(expiry) } : {}),
			crawlable: crawlable(),
			forwardQuery: forwardQuery(),
		});
	}

	return (
		<form class="shortlink-form" onSubmit={submit}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<label class="form-field form-field--wide">
				<span>Destination URL <span aria-hidden="true">*</span></span>
				<input
					type="url"
					name="long-url"
					value={longUrl()}
					onInput={(event) => setLongUrl(event.currentTarget.value)}
					maxlength={4096}
					placeholder="https://example.com/long/path"
					required
				/>
			</label>
			<Show when={props.mode === 'create'}>
				<label class="form-field">
					<span>Custom short code <small>optional</small></span>
					<input
						name="custom-slug"
						value={customSlug()}
						onInput={(event) => setCustomSlug(event.currentTarget.value)}
						maxlength={255}
						pattern="[^/?#\\s,]+"
						placeholder="press-kit"
					/>
				</label>
			</Show>
			<label class={['form-field', { 'form-field--wide': props.mode === 'edit' }]}>
				<span>Title <small>optional</small></span>
				<input name="title" value={title()} onInput={(event) => setTitle(event.currentTarget.value)} maxlength={1000} />
			</label>
			<label class="form-field form-field--wide">
				<span>Tags <small>comma-separated</small></span>
				<input
					name="tags"
					value={tagText()}
					onInput={(event) => setTagText(event.currentTarget.value)}
					placeholder="press, campaign"
				/>
			</label>
			<label class="form-field">
				<span>Maximum visits <small>optional</small></span>
				<input
					type="number"
					name="max-visits"
					value={maxVisits()}
					onInput={(event) => setMaxVisits(event.currentTarget.value)}
					min="0"
					step="1"
				/>
			</label>
			<label class="form-field">
				<span>Expires <small>optional</small></span>
				<input
					type="datetime-local"
					name="valid-until"
					value={validUntil()}
					onInput={(event) => setValidUntil(event.currentTarget.value)}
				/>
			</label>
			<fieldset class="shortlink-options form-field--wide">
				<legend>Redirect options</legend>
				<label>
					<input
						type="checkbox"
						name="forward-query"
						checked={forwardQuery()}
						onInput={(event) => setForwardQuery(event.currentTarget.checked)}
					/>
					Forward query parameters
				</label>
				<label>
					<input
						type="checkbox"
						name="crawlable"
						checked={crawlable()}
						onInput={(event) => setCrawlable(event.currentTarget.checked)}
					/>
					Allow search engine crawling
				</label>
			</fieldset>
			<div class="form-actions form-field--wide">
				<a class="button button--secondary" href={props.cancelHref}>
					Cancel
				</a>
				<button type="submit" class="button" disabled={props.pending} aria-busy={props.pending ? 'true' : undefined}>
					{props.pending ? 'Saving…' : props.mode === 'create' ? 'Create shortlink' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}
