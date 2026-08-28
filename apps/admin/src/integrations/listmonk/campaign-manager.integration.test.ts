import { afterAll, describe, expect, it } from 'vitest';
import { createListmonkCampaignManager } from './campaign-manager.server';
import { createListmonkMailingListManager } from './mailing-list-manager.server';

const url = process.env['LISTMONK_CONTRACT_URL'];
const token = process.env['LISTMONK_CONTRACT_TOKEN'];
const enabled =
	process.env['LISTMONK_CONTRACT_CONFIRMATION'] === 'use-disposable-listmonk-contract' &&
	url === 'http://127.0.0.1:9000' &&
	token?.startsWith('contract-api:');
const config = enabled && url && token ? { LISTMONK_URL: url, LISTMONK_API_TOKEN: token } : undefined;
const campaigns = config ? createListmonkCampaignManager(config) : undefined;
const mailingLists = config ? createListmonkMailingListManager(config) : undefined;
const createdCampaignIds: number[] = [];
const createdListIds: number[] = [];

async function providerCampaign(id: number): Promise<Record<string, unknown>> {
	if (!url || !token) throw new Error('Disposable Listmonk contract was not configured.');
	const response = await fetch(`${url}/api/campaigns/${id}`, { headers: { Authorization: `token ${token}` } });
	if (!response.ok) throw new Error(`Disposable Listmonk detail failed with status ${response.status}.`);
	return ((await response.json()) as { data: Record<string, unknown> }).data;
}

async function putProviderCampaign(id: number, body: Record<string, unknown>): Promise<void> {
	if (!url || !token) throw new Error('Disposable Listmonk contract was not configured.');
	const response = await fetch(`${url}/api/campaigns/${id}`, {
		method: 'PUT',
		headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error(`Disposable Listmonk update failed with status ${response.status}.`);
}

describe.skipIf(!enabled)('Listmonk v6 campaign contract', () => {
	afterAll(async () => {
		const failures: unknown[] = [];
		if (campaigns) {
			try {
				if (createdCampaignIds.length > 0) await campaigns.delete([...createdCampaignIds]);
			} catch (error) {
				failures.push(error);
			}
		}
		if (mailingLists) {
			for (const id of createdListIds.reverse()) {
				try {
					await mailingLists.delete(id);
				} catch (error) {
					failures.push(error);
				}
			}
		}
		if (failures.length > 0) throw new AggregateError(failures, 'Disposable Listmonk campaign cleanup failed.');
	});

	it('round-trips regular and opt-in drafts, preserved provider fields, preview, scheduling, and bulk delete', async () => {
		if (!campaigns || !mailingLists) throw new Error('Disposable Listmonk contract managers were not configured.');
		const suffix = crypto.randomUUID().slice(0, 8);
		const list = await mailingLists.create({
			name: `Admin v2 campaign contract ${suffix}`,
			kind: 'private',
			optIn: 'double',
			description: 'Disposable campaign contract list',
		});
		createdListIds.push(list.id);

		const regular = await campaigns.create({
			type: 'regular',
			name: `Admin v2 regular campaign ${suffix}`,
			subject: 'Disposable regular campaign',
			fromEmail: '',
			listIds: [list.id],
			body: '<p>Campaign contract body</p>',
			contentType: 'html',
			templateId: null,
			tags: ['admin-contract'],
			sendAt: null,
		});
		createdCampaignIds.push(regular.id);
		await expect(campaigns.list()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: regular.id, status: 'draft' })]));
		await expect(campaigns.preview(regular.id)).resolves.toContain('Campaign contract body');

		const raw = await providerCampaign(regular.id);
		await putProviderCampaign(regular.id, {
			name: raw['name'],
			subject: raw['subject'],
			from_email: raw['from_email'],
			lists: (raw['lists'] as Array<{ id: number }>).map((entry) => entry.id),
			body: raw['body'],
			altbody: raw['altbody'],
			content_type: raw['content_type'],
			send_at: raw['send_at'],
			headers: [{ 'x-admin-contract': suffix }],
			attribs: { adminContract: suffix },
			tags: raw['tags'],
			messenger: raw['messenger'],
			template_id: raw['template_id'],
			archive: raw['archive'],
			archive_slug: raw['archive_slug'],
			archive_template_id: raw['archive_template_id'],
			archive_meta: { adminContract: suffix },
			media: [],
			body_source: raw['body_source'],
		});

		const seeded = await campaigns.get(regular.id);
		if (!seeded) throw new Error('Disposable regular campaign disappeared.');
		const scheduledAt = '2099-01-01T00:00:00.000Z';
		await campaigns.update({
			id: seeded.id,
			expectedUpdatedAt: seeded.updatedAt,
			name: `Admin v2 updated campaign ${suffix}`,
			subject: 'Updated disposable regular campaign',
			fromEmail: seeded.fromEmail,
			listIds: [list.id],
			body: '<p>Updated campaign contract body</p>',
			contentType: 'html',
			templateId: seeded.templateId,
			tags: ['admin-contract', 'preserved'],
			sendAt: scheduledAt,
		});
		const preserved = await providerCampaign(regular.id);
		expect(preserved['headers']).toEqual([{ 'x-admin-contract': suffix }]);
		expect(preserved['attribs']).toEqual({ adminContract: suffix });
		expect(preserved['archive_meta']).toEqual({ adminContract: suffix });

		const schedulable = await campaigns.get(regular.id);
		if (!schedulable) throw new Error('Disposable regular campaign disappeared after update.');
		await expect(campaigns.transition(regular.id, 'scheduled')).resolves.toMatchObject({ status: 'scheduled' });
		await expect(campaigns.transition(regular.id, 'draft')).resolves.toMatchObject({ status: 'draft' });

		const optin = await campaigns.create({
			type: 'optin',
			name: `Admin v2 opt-in campaign ${suffix}`,
			subject: 'Confirm your subscription',
			fromEmail: '',
			listIds: [list.id],
			body: '',
			contentType: 'richtext',
			templateId: null,
			tags: ['admin-contract'],
			sendAt: null,
		});
		createdCampaignIds.push(optin.id);
		expect(optin.type).toBe('optin');
		expect(optin.body).toContain('OptinURL');

		await campaigns.delete([regular.id, optin.id]);
		createdCampaignIds.splice(0);
		await expect(campaigns.get(regular.id)).resolves.toBeNull();
		await expect(campaigns.get(optin.id)).resolves.toBeNull();
	});
});
