import { createSignal } from 'solid-js';
import { QrCode } from '~/ui/qr-code';
import { RichTextEditor } from '~/ui/rich-text-editor';

const INITIAL_HTML = '<p>Solid 2 keeps Lexical framework-neutral.</p>';

export default function ContentCompatibility() {
	const [editorValue, setEditorValue] = createSignal(INITIAL_HTML);
	const [lastEditorChange, setLastEditorChange] = createSignal(INITIAL_HTML);
	const [editorDisabled, setEditorDisabled] = createSignal(false);
	const [qrUrl, setQrUrl] = createSignal('https://y4h.org/');
	const [qrColor, setQrColor] = createSignal('#d2a8ff');

	return (
		<main class="shell">
			<p class="eyebrow">Dependency gallery</p>
			<h1>Framework-neutral content engines</h1>
			<p>
				<a href="/compatibility">Back to the platform smoke</a>
			</p>

			<section aria-labelledby="editor-heading">
				<h2 id="editor-heading">Lexical lifecycle adapter</h2>
				<div class="gallery-actions">
					<button type="button" onClick={() => setEditorValue('<p>External replacement.</p>')}>
						Replace editor value
					</button>
					<button type="button" onClick={() => setEditorValue(lastEditorChange())}>
						Restore last editor change
					</button>
					<button type="button" onClick={() => setEditorDisabled((disabled) => !disabled)}>
						{editorDisabled() ? 'Enable editor' : 'Disable editor'}
					</button>
				</div>
				<RichTextEditor
					label="Campaign content"
					value={editorValue()}
					disabled={editorDisabled()}
					onChange={(html) => {
						setLastEditorChange(html);
						setEditorValue(html);
					}}
				/>
				<output class="compat-output" aria-label="Generated HTML">
					{editorValue()}
				</output>
			</section>

			<section aria-labelledby="qr-heading">
				<h2 id="qr-heading">QR renderer lifecycle adapter</h2>
				<div class="compat-fields">
					<label for="qr-url">QR destination</label>
					<input id="qr-url" type="url" value={qrUrl()} onInput={(event) => setQrUrl(event.currentTarget.value)} />
					<label for="qr-color">QR color</label>
					<input id="qr-color" type="color" value={qrColor()} onInput={(event) => setQrColor(event.currentTarget.value)} />
				</div>
				<QrCode label="QR preview" url={qrUrl()} color={qrColor()} />
			</section>
		</main>
	);
}
