import { describe, expect, it, mock } from 'bun:test';
import {
	createListmonkPublicSubscriptions,
	ListmonkPublicHttpError,
	ListmonkPublicProtocolError,
	ListmonkPublicTransportError
} from './listmonk-public.server';

const publicLists = [
	{ uuid: 'list-one', name: 'One' },
	{ uuid: 'list-two', name: 'Two' }
];

function json(value: unknown, status = 200): Response {
	return Response.json(value, { status });
}

describe('Listmonk public subscription gateway', () => {
	it('strictly validates the whole public catalog instead of returning a partial result', async () => {
		const valid = createListmonkPublicSubscriptions('https://mail.example', mock(async () => json(publicLists)));
		await expect(valid.listPublicLists()).resolves.toEqual(publicLists);

		for (const malformed of [
			[...publicLists, { uuid: 7, name: 'Invalid' }],
			[
				{ uuid: 'duplicate', name: 'A' },
				{ uuid: 'duplicate', name: 'B' }
			]
		]) {
			const client = createListmonkPublicSubscriptions(
				'https://mail.example',
				mock(async () => json(malformed))
			);
			await expect(client.listPublicLists()).rejects.toBeInstanceOf(ListmonkPublicProtocolError);
		}
	});

	it('uses the exact public endpoints and validates has_optin', async () => {
		const request = mock(async (input: string | URL, init?: RequestInit) => {
			expect(String(input)).toBe('https://mail.example/api/public/subscription');
			expect(init?.method).toBe('POST');
			expect(JSON.parse(String(init?.body))).toEqual({
				email: 'member@example.test',
				name: 'Member',
				list_uuids: ['list-one']
			});
			return json({ data: { has_optin: true } });
		});
		const client = createListmonkPublicSubscriptions('https://mail.example/', request);
		await expect(
			client.subscribe({
				email: 'member@example.test',
				name: 'Member',
				listUuids: ['list-one']
			})
		).resolves.toEqual({ hasOptin: true });

		const malformed = createListmonkPublicSubscriptions(
			'https://mail.example',
			mock(async () => json({ data: true }))
		);
		await expect(
			malformed.subscribe({ email: 'member@example.test', listUuids: ['list-one'] })
		).rejects.toBeInstanceOf(ListmonkPublicProtocolError);
	});

	it('maps HTTP and transport failures without exposing response bodies', async () => {
		const http = createListmonkPublicSubscriptions(
			'https://mail.example',
			mock(async () => new Response('{"email":"private@example.test"}', { status: 422 }))
		);
		await expect(http.listPublicLists()).rejects.toEqual(new ListmonkPublicHttpError(422));

		const transport = createListmonkPublicSubscriptions(
			'https://mail.example',
			mock(async () => {
				throw new Error('network included private@example.test');
			})
		);
		await expect(transport.listPublicLists()).rejects.toBeInstanceOf(ListmonkPublicTransportError);
	});

	it('rejects oversized successful responses before parsing them', async () => {
		const client = createListmonkPublicSubscriptions(
			'https://mail.example',
			mock(async () =>
				new Response('[]', {
					headers: { 'content-type': 'application/json', 'content-length': '1000001' }
				})
			)
		);
		await expect(client.listPublicLists()).rejects.toBeInstanceOf(ListmonkPublicProtocolError);
	});
});
