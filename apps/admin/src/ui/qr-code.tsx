import QRCodeStyling, { type Options } from 'qr-code-styling';
import { Palette } from 'lucide';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { createCommandTask } from './command-task';
import { Icon } from './icon';
import { logoDataUrl } from './logo-data-url';
import './qr-code.css';

const colorPresets = [
	{ name: 'Brown', value: '#361d12' },
	{ name: 'Orange', value: '#ff6f00' },
	{ name: 'Magenta', value: '#8f005a' },
	{ name: 'Cream', value: '#fff7ef' },
] as const;

const backgroundPresets = [
	{ name: 'White', value: '#ffffff' },
	{ name: 'Cream', value: '#fff7ef' },
	{ name: 'Dark', value: '#262637' },
	{ name: 'Transparent', value: 'transparent' },
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

function ColorPicker(props: {
	label: string;
	value: string;
	colors: ReadonlyArray<{ name: string; value: string }>;
	onChange: (value: string) => void;
}) {
	return (
		<div class="qr-code-color-picker" role="group" aria-label={props.label}>
			<span>{props.label}</span>
			<div class="qr-code-presets">
				<For each={props.colors}>{(color) => (
					<button type="button" class="qr-code-preset" aria-label={color.name} title={color.name}
						aria-pressed={props.value === color.value ? 'true' : 'false'} onClick={() => props.onChange(color.value)}>
						<span class={['qr-code-swatch', { 'qr-code-transparent': color.value === 'transparent' }]} style={{ 'background-color': color.value }} />
					</button>
				)}</For>
				<label class={['qr-code-preset', 'qr-code-custom', { 'qr-code-preset--active': !props.colors.some((color) => color.value === props.value) }]} title={`Custom ${props.label.toLowerCase()}`}>
					<Icon node={Palette} size={20} />
					<input type="color" aria-label={`Custom ${props.label.toLowerCase()}`} value={props.value === 'transparent' ? '#ffffff' : props.value}
						onInput={(event) => props.onChange(event.currentTarget.value)} />
				</label>
			</div>
		</div>
	);
}

export function QrCode(props: QrCodeProps) {
	let container: HTMLDivElement | undefined;
	let instance: QRCodeStyling | undefined;
	const [ready, setReady] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const downloadTask = createCommandTask();
	const [foreground, setForeground] = createSignal<string>();
	const [background, setBackground] = createSignal('#ffffff');
	const [selectedDotStyle, setSelectedDotStyle] = createSignal(0);
	const [selectedCornerStyle, setSelectedCornerStyle] = createSignal(0);
	const [showLogo, setShowLogo] = createSignal(false);
	const selectedForeground = createMemo(() => foreground() ?? props.color ?? colorPresets[0].value);
	const options = createMemo<Options>(() => {
		const foreground = selectedForeground();
		const corner = cornerStyles[selectedCornerStyle()]!.value;
		return {
			type: 'svg',
			width: 1000,
			height: 1000,
			margin: 8,
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
				class={['qr-code', { 'qr-code-transparent': background() === 'transparent' }]}
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
				<ColorPicker label="QR color" value={selectedForeground()} onChange={setForeground}
					colors={colorPresets.map((preset, index) => index === 0 && props.color ? { ...preset, value: props.color } : preset)} />
				<ColorPicker label="Background color" value={background()} onChange={setBackground} colors={backgroundPresets} />
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
