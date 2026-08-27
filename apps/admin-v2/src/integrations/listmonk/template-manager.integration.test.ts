import { afterAll, describe, expect, it } from 'vitest';
import { createListmonkTemplateManager } from './template-manager.server';

const url = process.env['LISTMONK_CONTRACT_URL'];
const token = process.env['LISTMONK_CONTRACT_TOKEN'];
const enabled =
	process.env['LISTMONK_CONTRACT_CONFIRMATION'] === 'use-disposable-listmonk-contract' &&
	url === 'http://127.0.0.1:9000' &&
	token?.startsWith('contract-api:');

const manager = enabled && url && token
	? createListmonkTemplateManager({ LISTMONK_URL: url, LISTMONK_API_TOKEN: token })
	: undefined;
const createdIds: number[] = [];
let originalDefaultId = 0;

describe.skipIf(!enabled)('Listmonk v6 template contract', () => {
	afterAll(async () => {
		if (!manager) return;
		const failures: unknown[] = [];
		if (originalDefaultId > 0) {
			try {
				await manager.setDefault(originalDefaultId);
			} catch (error) {
				failures.push(error);
			}
		}
		for (const id of createdIds.reverse()) {
			try {
				await manager.delete(id);
			} catch (error) {
				failures.push(error);
			}
		}
		if (failures.length > 0) throw new AggregateError(failures, 'Disposable Listmonk fixture cleanup failed.');
	});

	it('round-trips the exact list/detail/preview/CRUD/default protocols', async () => {
		if (!manager) throw new Error('Disposable Listmonk contract manager was not configured.');
		const initial = await manager.list();
		originalDefaultId = initial.find((template) => template.isDefault)?.id ?? 0;
		expect(originalDefaultId).toBeGreaterThan(0);
		expect(initial.some((template) => template.kind === 'campaign_visual')).toBe(true);

		const suffix = crypto.randomUUID().slice(0, 8);
		const transactional = await manager.create({
			name: `Admin v2 contract tx ${suffix}`,
			kind: 'tx',
			subject: 'Contract subject',
			body: '<p>Contract transactional body</p>',
		});
		createdIds.push(transactional.id);
		await expect(manager.get(transactional.id)).resolves.toEqual(transactional);
		await manager.update({ ...transactional, name: `Admin v2 updated tx ${suffix}`, body: '<p>Updated body</p>' });
		await expect(manager.get(transactional.id)).resolves.toMatchObject({ name: `Admin v2 updated tx ${suffix}`, body: '<p>Updated body</p>' });
		await expect(manager.previewSaved(transactional.id)).resolves.toContain('Updated body');
		await expect(manager.previewDraft({ kind: 'tx', body: '<strong>Draft preview</strong>' })).resolves.toContain('Draft preview');

		const campaign = await manager.create({
			name: `Admin v2 contract campaign ${suffix}`,
			kind: 'campaign',
			subject: '',
			body: '<main>{{ template "content" . }}</main>',
		});
		createdIds.push(campaign.id);
		await manager.setDefault(campaign.id);
		await expect(manager.list()).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: campaign.id, isDefault: true })]),
		);

		await manager.setDefault(originalDefaultId);
		originalDefaultId = 0;
		await manager.delete(campaign.id);
		createdIds.splice(createdIds.indexOf(campaign.id), 1);
		await manager.delete(transactional.id);
		createdIds.splice(createdIds.indexOf(transactional.id), 1);
		await expect(manager.get(transactional.id)).resolves.toBeNull();
	});
});
