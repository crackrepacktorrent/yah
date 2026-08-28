import { afterAll, describe, expect, it } from 'vitest';
import { createListmonkMailingListManager } from './mailing-list-manager.server';

const url = process.env['LISTMONK_CONTRACT_URL'];
const token = process.env['LISTMONK_CONTRACT_TOKEN'];
const enabled =
	process.env['LISTMONK_CONTRACT_CONFIRMATION'] === 'use-disposable-listmonk-contract' &&
	url === 'http://127.0.0.1:9000' &&
	token?.startsWith('contract-api:');

const manager = enabled && url && token
	? createListmonkMailingListManager({ LISTMONK_URL: url, LISTMONK_API_TOKEN: token })
	: undefined;
const createdIds: number[] = [];

describe.skipIf(!enabled)('Listmonk v6 mailing-list contract', () => {
	afterAll(async () => {
		if (!manager) return;
		const failures: unknown[] = [];
		for (const id of createdIds.reverse()) {
			try {
				await manager.delete(id);
			} catch (error) {
				failures.push(error);
			}
		}
		if (failures.length > 0) throw new AggregateError(failures, 'Disposable Listmonk mailing-list cleanup failed.');
	});

	it('round-trips the bounded catalog, detail, full PUT, description quirk, and delete protocols', async () => {
		if (!manager) throw new Error('Disposable Listmonk contract manager was not configured.');
		const suffix = crypto.randomUUID().slice(0, 8);
		const created = await manager.create({
			name: `Admin v2 list contract ${suffix}`,
			kind: 'private',
			optIn: 'double',
			description: 'Original contract description',
		});
		createdIds.push(created.id);

		await expect(manager.list()).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id, uuid: created.uuid })]),
		);
		await expect(manager.get(created.id)).resolves.toMatchObject({
			name: `Admin v2 list contract ${suffix}`,
			kind: 'private',
			optIn: 'double',
			status: 'active',
			description: 'Original contract description',
			tags: [],
		});

		await manager.update({
			id: created.id,
			name: `Admin v2 updated list ${suffix}`,
			kind: 'public',
			optIn: 'single',
			status: 'archived',
			description: 'Replacement contract description',
			tags: ['contract-preserved'],
		});
		await expect(manager.get(created.id)).resolves.toMatchObject({
			name: `Admin v2 updated list ${suffix}`,
			kind: 'public',
			optIn: 'single',
			status: 'archived',
			description: 'Replacement contract description',
			tags: ['contract-preserved'],
		});

		await manager.update({
			id: created.id,
			name: `Admin v2 updated list ${suffix}`,
			kind: 'public',
			optIn: 'single',
			status: 'archived',
			description: '',
			tags: ['contract-preserved'],
		});
		await expect(manager.get(created.id)).resolves.toMatchObject({
			description: 'Replacement contract description',
			tags: ['contract-preserved'],
		});

		await manager.delete(created.id);
		createdIds.splice(createdIds.indexOf(created.id), 1);
		await expect(manager.get(created.id)).resolves.toBeNull();
	});
});
