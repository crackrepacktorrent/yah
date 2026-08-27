import { query } from '@solidjs/router';
import pLimit from 'p-limit';
import { getListmonk, type ListmonkCampaign } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';
import {
	CampaignAnalyticsInputSchema,
	CampaignStatusInputSchema,
	CreateCampaignInputSchema,
	TestCampaignInputSchema,
	UpdateCampaignInputSchema,
	type CampaignAnalyticsInput,
	type CampaignStatusInput,
	type CreateCampaignInput,
	type TestCampaignInput,
	type UpdateCampaignInput,
} from '~/lib/admin-contracts';
import { parseInput, positiveIntegerSchema, idListSchema } from '~/server/validation';

const ANALYTICS_CONCURRENCY = 8;

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listCampaigns = query(async (): Promise<{ campaigns: ListmonkCampaign[]; total: number }> => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		const res = await getListmonk().listCampaigns({ per_page: 'all' });
		return { campaigns: res.data.results, total: res.data.total };
	});
}, 'listCampaigns');

export const getCampaign = query(async (id: number) => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		return getListmonk().getCampaign(parseInput(positiveIntegerSchema, id));
	});
}, 'getCampaign');

export const previewCampaign = query(async (id: number) => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		return getListmonk().previewCampaign(parseInput(positiveIntegerSchema, id));
	});
}, 'previewCampaign');

export const getCampaignAnalytics = query(async (params: CampaignAnalyticsInput) => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		const input = parseInput(CampaignAnalyticsInputSchema, params);
		const lm = getListmonk();
		const limit = pLimit(ANALYTICS_CONCURRENCY);
		const results = await Promise.all(
			input.campaignIds.map((id) => limit(() => lm.getAnalytics({ id, type: input.type, from: input.from, to: input.to }))),
		);
		return results.flat();
	});
}, 'getCampaignAnalytics');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createCampaign(params: CreateCampaignInput) {
	'use server';
	return withPermissions({ campaign: ['create'] }, async () => {
		const input = parseInput(CreateCampaignInputSchema, params);
		return getListmonk().createCampaign({
			name: input.name,
			subject: input.subject,
			from_email: input.fromEmail,
			lists: input.lists,
			body: input.body ?? '',
			content_type: input.contentType,
			template_id: input.templateId,
			tags: input.tags,
			send_at: input.sendAt,
		});
	});
}

export async function updateCampaign(params: UpdateCampaignInput) {
	'use server';
	return withPermissions({ campaign: ['edit'] }, async () => {
		const { id, fromEmail, contentType, templateId, sendAt, ...rest } = parseInput(UpdateCampaignInputSchema, params);
		return getListmonk().updateCampaign(id, {
			...rest,
			from_email: fromEmail,
			content_type: contentType,
			template_id: templateId,
			send_at: sendAt,
		});
	});
}

export async function deleteCampaigns(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ campaign: ['delete'] }, async () => {
		await getListmonk().deleteCampaigns(parseInput(idListSchema, ids));
	});
}

export async function updateCampaignStatus(params: CampaignStatusInput) {
	'use server';
	return withPermissions({ campaign: ['send'] }, async () => {
		const input = parseInput(CampaignStatusInputSchema, params);
		return getListmonk().updateCampaignStatus(input.id, input.status);
	});
}

export async function testCampaign(params: TestCampaignInput): Promise<void> {
	'use server';
	return withPermissions({ campaign: ['send'] }, async () => {
		const input = parseInput(TestCampaignInputSchema, params);
		await getListmonk().testCampaign(input.id, input.subscribers);
	});
}
