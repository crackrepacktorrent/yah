import { handleServerFunctionRequest, registerServerFunction } from '@solidjs/web/server-functions/server';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { PreviewNewEmailTemplateCommandSchema } from '~/features/email-templates/contracts';

vi.mock('~/router', () => ({ Router: {} }));
vi.mock('@solidjs/router/server', () => ({ createFlightDataCollector: () => () => undefined }));

import '~/server-config';

function templateRequest(id: string, body: string, headers: Record<string, string> = {}): Request {
	return new Request(`https://admin.example.test/_server/data/${id}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-server-function-format': '8',
			origin: 'https://admin.example.test',
			...headers,
		},
		body,
	});
}

describe('configured server-function payload limit', () => {
	it.each([
		['plain content', 'x'],
		['JSON-escaped content', '\u0001'],
	])('delivers the accepted 5 MB of %s to application validation', async (label, character) => {
		const id = `large-template-${label.replaceAll(' ', '-')}`;
		const command = { kind: 'tx', body: character.repeat(5_000_000) };
		let receivedBytes = 0;
		registerServerFunction(id, (input: unknown) => {
			const value = v.parse(PreviewNewEmailTemplateCommandSchema, input);
			receivedBytes = new TextEncoder().encode(value.body).byteLength;
			return receivedBytes;
		});

		const response = await handleServerFunctionRequest(templateRequest(id, JSON.stringify([command])), {
			provideEvent: (_event, run) => run(),
		});

		expect(response.status).toBe(200);
		expect(receivedBytes).toBe(5_000_000);
		await response.body?.cancel();
	});

	it('still rejects oversized arguments before dispatching the application function', async () => {
		const handler = vi.fn();
		registerServerFunction('oversized-template', handler);

		const response = await handleServerFunctionRequest(templateRequest('oversized-template', '[]', {
			'content-length': '32000001',
		}));

		expect(response.status).toBe(413);
		expect(handler).not.toHaveBeenCalled();
		await response.body?.cancel();
	});
});
