import QRCodeStyling from 'qr-code-styling';
import { For, Show, createEffect, createMemo, createSignal, onSettled, untrack } from 'solid-js';
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
	const [selectedPreset, setSelectedPreset] = createSignal(0);
	const [selectedDotStyle, setSelectedDotStyle] = createSignal(0);
	const [selectedCornerStyle, setSelectedCornerStyle] = createSignal(0);
	const [showLogo, setShowLogo] = createSignal(false);
	const selectedForeground = createMemo(() =>
		selectedPreset() === 0 && props.color ? props.color : colorPresets[selectedPreset()]!.foreground,
	);
	const selectedBackground = createMemo(() => colorPresets[selectedPreset()]!.background);

	function reportFailure(cause: unknown, message = 'QR preview could not be generated.'): void {
		console.error('[QrCode] Failed to render QR code', cause);
		setReady(false);
		setError(message);
	}

	onSettled(() => {
		setError(undefined);
		const initial = untrack(() => ({
			background: selectedBackground(),
			corner: cornerStyles[selectedCornerStyle()]!.value,
			dot: dotStyles[selectedDotStyle()]!.value,
			foreground: selectedForeground(),
			logo: showLogo(),
			url: props.url,
		}));
		try {
			if (!container) return;
			instance = new QRCodeStyling({
				type: 'svg',
				width: 1000,
				height: 1000,
				margin: 8,
				data: initial.url,
				image: initial.logo ? logoDataUrl(initial.foreground) : undefined,
				imageOptions: { crossOrigin: 'anonymous', hideBackgroundDots: true, imageSize: 0.35, margin: 4 },
				dotsOptions: { color: initial.foreground, type: initial.dot },
				cornersSquareOptions: { color: initial.foreground, type: initial.corner },
				cornersDotOptions: { color: initial.foreground, type: initial.corner === 'extra-rounded' ? 'dot' : initial.corner },
				backgroundOptions: { color: initial.background },
				qrOptions: { errorCorrectionLevel: 'H' },
			});
			container.replaceChildren();
			instance.append(container);
			if (initial.url.trim()) setReady(true);
			else setError('Enter a QR destination.');
		} catch (cause) {
			reportFailure(cause);
		}

		return () => {
			setReady(false);
			instance = undefined;
			container?.replaceChildren();
		};
	});

	createEffect(
		() => ({
			background: selectedBackground(),
			corner: cornerStyles[selectedCornerStyle()]!.value,
			dot: dotStyles[selectedDotStyle()]!.value,
			foreground: selectedForeground(),
			logo: showLogo(),
			url: props.url,
		}),
		(state) => {
			if (!instance) return;
			if (!state.url.trim()) {
				setReady(false);
				setError('Enter a QR destination.');
				return;
			}

			try {
				instance.update({
					data: state.url,
					image: state.logo ? logoDataUrl(state.foreground) : undefined,
					dotsOptions: { color: state.foreground, type: state.dot },
					cornersSquareOptions: { color: state.foreground, type: state.corner },
					cornersDotOptions: { color: state.foreground, type: state.corner === 'extra-rounded' ? 'dot' : state.corner },
					backgroundOptions: { color: state.background },
				});
				setError(undefined);
				setReady(true);
			} catch (cause) {
				reportFailure(cause);
			}
		},
	);

	async function download(extension: 'svg' | 'png'): Promise<void> {
		if (!instance || !ready()) return;
		try {
			await instance.download({ name: downloadName(props.title), extension });
		} catch (cause) {
			reportFailure(cause, 'QR code could not be downloaded.');
		}
	}

	return (
		<div class="qr-code-widget">
			<div
				ref={(element) => {
					container = element;
				}}
				class="qr-code"
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
					<button type="button" onClick={() => void download('svg')} disabled={!ready()}>Download SVG</button>
					<button type="button" onClick={() => void download('png')} disabled={!ready()}>Download PNG</button>
				</div>
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
