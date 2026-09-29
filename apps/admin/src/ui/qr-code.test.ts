import { createComponent, render } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const qrMock = vi.hoisted(() => ({
	append: vi.fn(),
	constructor: vi.fn(),
	download: vi.fn(),
	getRawData: vi.fn(),
	throwOnCreate: false,
}));

vi.mock('qr-code-styling', () => ({
	default: class TestQrCode {
		constructor(private options: unknown) {
			qrMock.constructor(options);
			if (qrMock.throwOnCreate) throw new Error('simulated renderer failure');
		}
		append = qrMock.append;
		getRawData = qrMock.getRawData;
		download = (options: unknown) => qrMock.download(this.options, options);
	},
}));

import { QrCode, type QrCodeProps } from './qr-code';
import { logoDataUrl } from './logo-data-url';

const disposers: Array<() => void> = [];
function mount(props: Partial<QrCodeProps> = {}) {
	const container = document.createElement('div');
	document.body.append(container);
	const dispose = render(() => createComponent(QrCode, {
		label: 'QR preview',
		url: 'https://y4h.link/signup',
		...props,
	}), container);
	disposers.push(() => { dispose(); container.remove(); });
	return container;
}

function chooseColor(container: HTMLElement, group: string, name: string) {
	container.querySelector<HTMLButtonElement>(`[role="group"][aria-label="${group}"] button[aria-label="${name}"]`)!.click();
}

function customColor(container: HTMLElement, label: string, value: string) {
	const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function downloadButton(container: HTMLElement, format = 'PNG') {
	return Array.from(container.querySelectorAll('button')).find((button) => button.textContent === `Download ${format}`)!;
}

function lastOptions() {
	return qrMock.constructor.mock.calls.at(-1)?.[0];
}

function decodeSvgDataUrl(dataUrl: string): string {
	expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
	return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
}

beforeEach(() => {
	vi.resetAllMocks();
	qrMock.throwOnCreate = false;
	qrMock.getRawData.mockResolvedValue(new Blob(['<svg/>']));
});

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.restoreAllMocks();
});

describe('QrCode', () => {
	test('surfaces an accessible generic failure when the renderer cannot initialize', async () => {
		qrMock.throwOnCreate = true;
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const container = mount();
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('QR preview could not be generated.'));
		expect(container.textContent).not.toContain('simulated renderer failure');
		expect(consoleError).toHaveBeenCalledOnce();
		expect(downloadButton(container).disabled).toBe(true);
	});

	test('renders the exact stable provider URL once on mount', async () => {
		const container = mount();
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		expect(qrMock.constructor).toHaveBeenCalledOnce();
		expect(lastOptions()).toMatchObject({ data: 'https://y4h.link/signup' });
	});

	test('colors the self-contained logo with custom and preset foregrounds', async () => {
		const container = mount({ color: '#123456' });
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
		await vi.waitFor(() => expect(decodeSvgDataUrl(lastOptions().image ?? '')).toContain('fill="#123456"'));
		container.querySelector<HTMLButtonElement>('button[aria-label="Magenta"]')!.click();
		await vi.waitFor(() => {
			expect(lastOptions().dotsOptions.color).toBe('#8f005a');
			expect(decodeSvgDataUrl(lastOptions().image)).toContain('fill="#8f005a"');
		});
		container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
		await vi.waitFor(() => expect(lastOptions().image).toBeUndefined());
	});

	test('offers independent swatch pickers with custom colors for the QR and background', async () => {
		const container = mount();
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		chooseColor(container, 'Background color', 'Cream');
		chooseColor(container, 'QR color', 'Magenta');
		await vi.waitFor(() => expect(lastOptions()).toMatchObject({
			backgroundOptions: { color: '#fff7ef' }, dotsOptions: { color: '#8f005a' },
		}));
		customColor(container, 'Custom qr color', '#123456');
		customColor(container, 'Custom background color', '#abccde');
		await vi.waitFor(() => expect(lastOptions()).toMatchObject({
			backgroundOptions: { color: '#abccde' }, dotsOptions: { color: '#123456' },
		}));
		expect(container.querySelectorAll('.qr-code-custom.qr-code-preset--active')).toHaveLength(2);
		chooseColor(container, 'QR color', 'Brown');
		await vi.waitFor(() => expect(lastOptions()).toMatchObject({
			backgroundOptions: { color: '#abccde' }, dotsOptions: { color: '#361d12' },
		}));
		chooseColor(container, 'Background color', 'Transparent');
		await vi.waitFor(() => expect(lastOptions().backgroundOptions.color).toBe('transparent'));
		expect(container.querySelector('.qr-code.qr-code-transparent')).not.toBeNull();
	});

	test('exports each current appearance from its own renderer so cached PNGs cannot go stale', async () => {
		const container = mount({ title: 'Signup / print' });
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		downloadButton(container).click();
		await vi.waitFor(() => expect(qrMock.download).toHaveBeenCalledTimes(1));
		chooseColor(container, 'Background color', 'Cream');
		await vi.waitFor(() => {
			expect(lastOptions().backgroundOptions.color).toBe('#fff7ef');
			expect(downloadButton(container).disabled).toBe(false);
		});
		downloadButton(container).click();
		await vi.waitFor(() => expect(qrMock.download).toHaveBeenCalledTimes(2));
		expect(qrMock.download.mock.calls[0]![0].backgroundOptions.color).toBe('#ffffff');
		expect(qrMock.download.mock.calls[1]).toEqual([lastOptions(), { name: 'qr-Signup-print', extension: 'png' }]);
	});

	test('keeps a failed download retryable without hiding the preview', async () => {
		qrMock.download.mockRejectedValueOnce(new Error('private failure'));
		const container = mount();
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		downloadButton(container).click();
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Please try again.'));
		expect(container.querySelector<HTMLElement>('[role="img"]')?.hidden).toBe(false);
		expect(downloadButton(container).disabled).toBe(false);
		downloadButton(container).click();
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).toBeNull());
	});

	test('waits for the latest render and ignores a superseded async failure', async () => {
		let rejectFirst!: (error: Error) => void;
		let resolveSecond!: (blob: Blob) => void;
		qrMock.getRawData
			.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
			.mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
		const container = mount();
		await vi.waitFor(() => expect(qrMock.constructor).toHaveBeenCalledOnce());
		expect(downloadButton(container).disabled).toBe(true);
		chooseColor(container, 'Background color', 'Cream');
		await vi.waitFor(() => expect(qrMock.constructor).toHaveBeenCalledTimes(2));
		rejectFirst(new Error('superseded'));
		await Promise.resolve();
		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(downloadButton(container).disabled).toBe(true);
		resolveSecond(new Blob(['<svg/>']));
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
	});

	test('surfaces async drawing failures', async () => {
		qrMock.getRawData.mockRejectedValueOnce(new Error('logo render failed'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const container = mount();
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('QR preview could not be generated.'));
		expect(downloadButton(container).disabled).toBe(true);
	});

	test('clears an old preview when the destination becomes empty and recovers', async () => {
		const [url, setUrl] = createSignal('https://example.test');
		const container = document.createElement('div');
		document.body.append(container);
		const dispose = render(() => createComponent(QrCode, { label: 'QR preview', get url() { return url(); } }), container);
		disposers.push(() => { dispose(); container.remove(); });
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		setUrl(' ');
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Enter a QR destination.'));
		expect(downloadButton(container).disabled).toBe(true);
		setUrl('https://example.test/new');
		await vi.waitFor(() => expect(downloadButton(container).disabled).toBe(false));
		expect(lastOptions().data).toBe('https://example.test/new');
	});
});

describe('logoDataUrl', () => {
	test('embeds the vector locally and escapes an arbitrary fill value', () => {
		const svg = decodeSvgDataUrl(logoDataUrl('#123456"/><script>'));
		expect(svg).toContain('fill="#123456&quot;/&gt;&lt;script&gt;"');
		expect(svg).not.toContain('/logo.svg');
		expect(svg).not.toContain('<script>');
	});
});
