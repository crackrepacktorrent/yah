import { type Component, For, createEffect, createSignal, onMount } from 'solid-js';
import { Switch } from './Switch';
import { Select } from './Select';
import { getLogoDataUrl } from './Logo';
import './QRCode.css';

const presets = [
	{ name: 'Brown',    fg: '#361d12', bg: 'transparent' },
	{ name: 'Orange',   fg: '#ff6f00', bg: 'transparent' },
	{ name: 'Magenta',  fg: '#8f005a', bg: 'transparent' },
	{ name: 'Inverted', fg: '#fff7ef', bg: 'transparent' },
];

const dotStyles = [
	{ name: 'Rounded',       value: 'rounded' },
	{ name: 'Dots',          value: 'dots' },
	{ name: 'Square',        value: 'square' },
	{ name: 'Classy',        value: 'classy' },
	{ name: 'Classy Rounded',value: 'classy-rounded' },
	{ name: 'Extra Rounded', value: 'extra-rounded' },
] as const;

const cornerStyles = [
	{ name: 'Extra Rounded', value: 'extra-rounded' },
	{ name: 'Square',        value: 'square' },
	{ name: 'Dot',           value: 'dot' },
	{ name: 'Rounded',       value: 'rounded' },
	{ name: 'Classy',        value: 'classy' },
	{ name: 'Classy Rounded',value: 'classy-rounded' },
] as const;

type QRCodeProps = {
	url: string;
	title?: string;
};

export const QRCode: Component<QRCodeProps> = (props) => {
	let container!: HTMLDivElement;
	let qrInstance: any;

	const [QRCtor, setQRCtor] = createSignal<any>(null);
	const [selectedPreset, setSelectedPreset] = createSignal(0);
	const [selectedDotStyle, setSelectedDotStyle] = createSignal(0);
	const [selectedCornerStyle, setSelectedCornerStyle] = createSignal(0);
	const [showLogo, setShowLogo] = createSignal(false);

	const dotStyleOptions = dotStyles.map((s, i) => ({ value: String(i), label: s.name }));
	const cornerStyleOptions = cornerStyles.map((s, i) => ({ value: String(i), label: s.name }));

	onMount(async () => {
		const mod = await import('qr-code-styling');
		setQRCtor(() => mod.default);
	});

	createEffect(() => {
		const Ctor = QRCtor();
		if (!Ctor) return;

		const presetIdx = selectedPreset();
		const dotIdx = selectedDotStyle();
		const cornerIdx = selectedCornerStyle();
		const preset = presets[presetIdx]!;
		const dotType = dotStyles[dotIdx]!.value;
		const cornerType = cornerStyles[cornerIdx]!.value;
		const logo = showLogo();
		const url = props.url;

		const opts: any = {
			width: 1000,
			height: 1000,
			data: url,
			margin: 8,
			dotsOptions: { color: preset.fg, type: dotType },
			cornersSquareOptions: { type: cornerType, color: preset.fg },
			cornersDotOptions: { type: cornerType === 'extra-rounded' ? 'dot' : cornerType, color: preset.fg },
			backgroundOptions: { color: preset.bg },
			qrOptions: { errorCorrectionLevel: 'H' },
		};

		if (logo) {
			opts.image = getLogoDataUrl(preset.fg);
			opts.imageOptions = { crossOrigin: 'anonymous', margin: 4, imageSize: 0.35 };
		}

		container.innerHTML = '';
		qrInstance = new Ctor(opts);
		qrInstance.append(container);
	});

	function downloadSVG() {
		qrInstance?.download({ name: `qr-${props.title ?? 'qr-code'}`, extension: 'svg' });
	}

	function downloadPNG() {
		qrInstance?.download({ name: `qr-${props.title ?? 'qr-code'}`, extension: 'png' });
	}

	return (
		<div class="qr-wrapper">
			<div class="qr-image" ref={container} />

			<div class="qr-controls">
				<div class="qr-downloads">
					<button type="button" class="dl-btn" onClick={downloadSVG}>SVG</button>
					<button type="button" class="dl-btn" onClick={downloadPNG}>PNG</button>
				</div>

				<div class="qr-presets">
					<For each={presets}>
						{(preset, i) => (
							<button
								type="button"
								class={`qr-preset-btn${selectedPreset() === i() ? ' qr-preset-btn--active' : ''}`}
								onClick={() => setSelectedPreset(i())}
								aria-label={preset.name}
								title={preset.name}
							>
								<span
									class="qr-preset-swatch"
									style={{
										background: preset.fg,
										'border-color': preset.fg === '#ffffff' ? '#d1d5db' : preset.fg,
									}}
								/>
							</button>
						)}
					</For>
				</div>

				<div class="qr-picker">
					<span class="qr-picker-label">Dots</span>
					<Select
						value={String(selectedDotStyle())}
						onValueChange={(v) => setSelectedDotStyle(Number(v))}
						options={dotStyleOptions}
					/>
				</div>

				<div class="qr-picker">
					<span class="qr-picker-label">Corners</span>
					<Select
						value={String(selectedCornerStyle())}
						onValueChange={(v) => setSelectedCornerStyle(Number(v))}
						options={cornerStyleOptions}
					/>
				</div>

				<Switch label="Logo" checked={showLogo()} onChange={setShowLogo} />
			</div>
		</div>
	);
};
