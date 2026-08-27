import { createComponent, render } from '@solidjs/web';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const qrMock = vi.hoisted(() => ({
	append: vi.fn(),
	constructor: vi.fn(),
	download: vi.fn(),
	throwOnCreate: true,
	update: vi.fn(),
}));

vi.mock('qr-code-styling', () => {
	return {
		default: class BrokenQrCode {
			constructor(options: unknown) {
				qrMock.constructor(options);
				if (qrMock.throwOnCreate) throw new Error('simulated renderer failure');
			}

			append = qrMock.append;
			download = qrMock.download;
			update = qrMock.update;
		},
	};
});

import { QrCode } from './qr-code';
import { logoDataUrl } from './logo-data-url';

function decodeSvgDataUrl(dataUrl: string): string {
	expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
	return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
}

describe('QrCode', () => {
	beforeEach(() => {
		qrMock.append.mockClear();
		qrMock.constructor.mockClear();
		qrMock.download.mockClear();
		qrMock.update.mockClear();
	});

	test('surfaces an accessible generic failure when the renderer cannot initialize', async () => {
		qrMock.throwOnCreate = true;
		const container = document.createElement('div');
		document.body.append(container);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const dispose = render(
			() => createComponent(QrCode, { label: 'QR preview', url: 'https://example.test' }),
			container,
		);

		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('QR preview could not be generated.'));
		expect(container.textContent).not.toContain('simulated renderer failure');
		expect(consoleError).toHaveBeenCalledOnce();

		dispose();
		consoleError.mockRestore();
		container.remove();
	});

	test('encodes the exact provider short URL that keeps printed QR destinations stable', async () => {
		qrMock.throwOnCreate = false;
		qrMock.constructor.mockClear();
		const container = document.createElement('div');
		document.body.append(container);
		const shortUrl = 'https://y4h.link/signup';
		const dispose = render(
			() => createComponent(QrCode, { label: 'Printed signup QR', url: shortUrl }),
			container,
		);

		await vi.waitFor(() => expect(qrMock.constructor).toHaveBeenCalled());
		expect(qrMock.constructor.mock.calls[0]?.[0]).toMatchObject({ data: shortUrl });

		dispose();
		container.remove();
	});

	test('colors the self-contained logo with custom and preset foregrounds', async () => {
		qrMock.throwOnCreate = false;
		const container = document.createElement('div');
		document.body.append(container);
		const dispose = render(
			() => createComponent(QrCode, { color: '#123456', label: 'Color-aware QR', url: 'https://example.test' }),
			container,
		);

		await vi.waitFor(() => expect(qrMock.constructor).toHaveBeenCalled());
		const logoToggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(logoToggle).not.toBeNull();
		logoToggle!.click();

		await vi.waitFor(() => {
			const options = qrMock.update.mock.calls.at(-1)?.[0] as { image?: string } | undefined;
			expect(decodeSvgDataUrl(options?.image ?? '')).toContain('fill="#123456"');
		});
		const customOptions = qrMock.update.mock.calls.at(-1)?.[0] as { data?: string } | undefined;
		expect(customOptions?.data).toBe('https://example.test');

		container.querySelector<HTMLButtonElement>('button[aria-label="Magenta"]')!.click();
		await vi.waitFor(() => {
			const options = qrMock.update.mock.calls.at(-1)?.[0] as { dotsOptions?: { color?: string }; image?: string } | undefined;
			expect(options?.dotsOptions?.color).toBe('#8f005a');
			expect(decodeSvgDataUrl(options?.image ?? '')).toContain('fill="#8f005a"');
		});

		dispose();
		container.remove();
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
