import QRCodeStyling, { type Options } from 'qr-code-styling';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { createCommandTask } from './command-task';
import { logoDataUrl } from './logo-data-url';
import './qr-code.css';

const colorPresets = [
	{ name: 'Brown', foreground: '#361d12', background: '#ffffff' },
	{ name: 'Orange', foreground: '#ff6f00', background: '#ffffff' },
	{ name: 'Magenta', foreground: '#8f005a', background: '#ffffff' },
	{ name: 'Inverted', foreground: '#fff7ef', background: '#262637' },
] as const;

const dotStyles = [
	{ name: 'Rounded', value: 'rounded' },
	{ name: 'Dots', value: 'dots' },
	{ name: 'Square', value: 'square' },
	{ name: 'Classy', value: 'classy' },
	{ name: 'Classy Rounded', value: 'classy-rounded' },
	{ name: 'Extra Rounded', value: 'extra-rounded' },
] as const;

const cornerStyles = [
	{ name: 'Extra Rounded', value: 'extra-rounded' },
	{ name: 'Square', value: 'square' },
	{ name: 'Dot', value: 'dot' },
	{ name: 'Rounded', value: 'rounded' },
	{ name: 'Classy', value: 'classy' },
	{ name: 'Classy Rounded', value: 'classy-rounded' },
] as const;

export type QrCodeProps = {
	color?: string;
	label: string;
	title?: string;
	url: string;
};

function downloadName(title: string | undefined): string {
	const safeTitle = title?.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'qr-code';
	return `qr-${safeTitle}`;
}

export function QrCode(props: QrCodeProps) {
	let container: HTMLDivElement | undefined;
	let instance: QRCodeStyling | undefined;
	const [ready, setReady] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const downloadTask = createCommandTask();
	const [selectedPreset, setSelectedPreset] = createSignal(0);
	const [selectedBackground, setSelectedBackground] = createSignal('preset');
	const [customBackground, setCustomBackground] = createSignal('#ffffff');
	const [selectedDotStyle, setSelectedDotStyle] = createSignal(0);
	const [selectedCornerStyle, setSelectedCornerStyle] = createSignal(0);
	const [showLogo, setShowLogo] = createSignal(false);
	const selectedForeground = createMemo(() =>
		selectedPreset() === 0 && props.color ? props.color : colorPresets[selectedPreset()]!.foreground,
	);
	const background = createMemo(() => selectedBackground() === 'preset'
		? colorPresets[selectedPreset()]!.background
		: selectedBackground() === 'custom' ? customBackground() : selectedBackground());
	const options = createMemo<Options>(() => {
		const foreground = selectedForeground();
		const corner = cornerStyles[selectedCornerStyle()]!.value;
		return {
			type: 'svg',
			width: 1000,
			height: 1000,
			// Leave at least four modules clear even for the smallest (21-module) QR.
			margin: 140,
			data: props.url,
			image: showLogo() ? logoDataUrl(foreground) : undefined,
			imageOptions: { crossOrigin: 'anonymous', hideBackgroundDots: true, imageSize: 0.35, margin: 4 },
			dotsOptions: { color: foreground, type: dotStyles[selectedDotStyle()]!.value },
			cornersSquareOptions: { color: foreground, type: corner },
			cornersDotOptions: { color: foreground, type: corner === 'extra-rounded' ? 'dot' : corner },
			backgroundOptions: { color: background() },
			qrOptions: { errorCorrectionLevel: 'H' },
		};
	});

	createEffect(options, (state) => {
		if (!container) return;
		let active = true;
		setReady(false);
		setError(undefined);
		downloadTask.clearError();
		container.replaceChildren();

		function reportFailure(cause: unknown): void {
			if (!active) return;
			console.error('[QrCode] Failed to render QR code', cause);
			setError('QR preview could not be generated.');
		}

		if (!state.data?.trim()) {
			setError('Enter a QR destination.');
		} else if (state.backgroundOptions?.color?.toLowerCase() === state.dotsOptions?.color?.toLowerCase()) {
			setError('Choose different QR and background colors so the code is visible.');
		} else {
			try {
				// Each appearance owns its renderer. qr-code-styling retains its PNG
				// canvas across update(), which otherwise exports an earlier design.
				const rendered = new QRCodeStyling(state);
				instance = rendered;
				rendered.append(container);
				// Logo drawing is asynchronous; catch failures and enable downloads
				// only after this particular appearance has finished rendering.
				void rendered.getRawData('svg').then(() => {
					if (active) setReady(true);
				}, reportFailure);
			} catch (cause) {
				reportFailure(cause);
			}
		}

		return () => {
			active = false;
			instance = undefined;
			container?.replaceChildren();
		};
	});

	async function download(extension: 'svg' | 'png'): Promise<void> {
		const rendered = instance;
		if (!rendered || !ready()) return;
		const name = downloadName(props.title);
		await downloadTask.run(async () => {
			await rendered.download({ name, extension });
		}, 'QR code could not be downloaded. Please try again.');
	}

	return (
		<div class="qr-code-widget">
			<div
				ref={(element) => {
					container = element;
				}}
				class={['qr-code', { 'qr-code--transparent': selectedBackground() === 'transparent' }]}
				role={error() ? undefined : 'img'}
				aria-label={error() ? undefined : props.label}
				aria-busy={!error() && !ready() ? 'true' : undefined}
				hidden={!!error()}
			/>
			<Show when={error()}>
				{(message) => <p class="qr-code-error" role="alert">{message()}</p>}
			</Show>
			<div class="qr-code-controls" role="group" aria-label="QR code appearance">
				<div class="qr-code-downloads">
					<button type="button" onClick={() => void download('svg')} disabled={!ready() || downloadTask.pending()}>Download SVG</button>
					<button type="button" onClick={() => void download('png')} disabled={!ready() || downloadTask.pending()}>Download PNG</button>
				</div>
				<Show when={downloadTask.error()}>{(message) => <p class="qr-code-error" role="alert">{message()}</p>}</Show>
				<div class="qr-code-presets" role="group" aria-label="Color preset">
					<For each={colorPresets}>
						{(preset, index) => (
							<button
								type="button"
								class={['qr-code-preset', { 'qr-code-preset--active': selectedPreset() === index() }]}
								onClick={() => setSelectedPreset(index())}
								aria-label={preset.name}
								aria-pressed={selectedPreset() === index() ? 'true' : 'false'}
							>
								<span style={{ background: index() === 0 && props.color ? props.color : preset.foreground }} />
							</button>
						)}
					</For>
				</div>
				<label>
					<span>Background</span>
					<select value={selectedBackground()} onChange={(event) => setSelectedBackground(event.currentTarget.value)}>
						<option value="preset">Match color preset</option>
						<option value="#ffffff">White</option>
						<option value="#fff7ef">Cream</option>
						<option value="#262637">Dark</option>
						<option value="transparent">Transparent</option>
						<option value="custom">Custom color</option>
					</select>
				</label>
				<Show when={selectedBackground() === 'custom'}>
					<label>
						<span>Custom background color</span>
						<input type="color" value={customBackground()} onInput={(event) => setCustomBackground(event.currentTarget.value)} />
					</label>
				</Show>
				<label>
					<span>Dots</span>
					<select value={selectedDotStyle()} onChange={(event) => setSelectedDotStyle(Number(event.currentTarget.value))}>
						<For each={dotStyles}>{(style, index) => <option value={index()}>{style.name}</option>}</For>
					</select>
				</label>
				<label>
					<span>Corners</span>
					<select value={selectedCornerStyle()} onChange={(event) => setSelectedCornerStyle(Number(event.currentTarget.value))}>
						<For each={cornerStyles}>{(style, index) => <option value={index()}>{style.name}</option>}</For>
					</select>
				</label>
				<label class="qr-code-logo-option">
					<input type="checkbox" checked={showLogo()} onInput={(event) => setShowLogo(event.currentTarget.checked)} />
					Include logo
				</label>
			</div>
		</div>
	);
}
