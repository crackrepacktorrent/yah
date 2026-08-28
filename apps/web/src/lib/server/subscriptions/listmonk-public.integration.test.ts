import { describe, expect, it } from 'bun:test';
import { createListmonkPublicSubscriptions } from './listmonk-public.server';

const url = process.env['LISTMONK_CONTRACT_URL'];
const listUuid = process.env['LISTMONK_PUBLIC_CONTRACT_LIST_UUID'];
const enabled =
	process.env['LISTMONK_CONTRACT_CONFIRMATION'] === 'use-disposable-listmonk-contract' &&
	url === 'http://127.0.0.1:9000' &&
	typeof listUuid === 'string' &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listUuid);

const gateway = enabled && url ? createListmonkPublicSubscriptions(url) : undefined;

describe.skipIf(!enabled)('Listmonk v6 public subscription contract', () => {
	it('reads the public catalog and submits through the unauthenticated single-opt-in endpoint', async () => {
		if (!gateway || !listUuid) throw new Error('Disposable Listmonk public contract was not configured.');
		await expect(gateway.listPublicLists()).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ uuid: listUuid })]),
		);
		await expect(
			gateway.subscribe({
				email: `public-contract-${crypto.randomUUID()}@example.test`,
				name: 'Public contract',
				listUuids: [listUuid]
			}),
		).resolves.toEqual({ hasOptin: false });
	});
});
