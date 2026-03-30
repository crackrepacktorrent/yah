import { query } from '@solidjs/router';
import { getListmonk, type ListmonkCampaign } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

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
		return getListmonk().getCampaign(id);
	});
}, 'getCampaign');

export const previewCampaign = query(async (id: number) => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		return getListmonk().previewCampaign(id);
	});
}, 'previewCampaign');

export const getCampaignAnalytics = query(async (params: {
	campaignIds: number[];
	type: 'views' | 'clicks';
	from: string;
	to: string;
}) => {
	'use server';
	return withPermissions({ campaign: ['view'] }, async () => {
		const lm = getListmonk();
		const results = await Promise.all(
			params.campaignIds.map((id) => lm.getAnalytics({ id, type: params.type, from: params.from, to: params.to })),
		);
		return results.flat();
	});
}, 'getCampaignAnalytics');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createCampaign(params: {
	name: string;
	subject: string;
	fromEmail?: string;
	lists: number[];
	body?: string;
	contentType?: 'richtext' | 'html' | 'markdown' | 'plain';
	templateId?: number;
	tags?: string[];
	sendAt?: string;
}) {
	'use server';
	return withPermissions({ campaign: ['create'] }, async () => {
		return getListmonk().createCampaign({
			name: params.name,
			subject: params.subject,
			from_email: params.fromEmail,
			lists: params.lists,
			body: params.body ?? '',
			content_type: params.contentType,
			template_id: params.templateId,
			tags: params.tags,
			send_at: params.sendAt,
		});
	});
}

export async function updateCampaign(params: {
	id: number;
	name?: string;
	subject?: string;
	fromEmail?: string;
	lists: number[];
	body?: string;
	contentType?: 'richtext' | 'html' | 'markdown' | 'plain';
	templateId?: number;
	tags?: string[];
	sendAt?: string | null;
}) {
	'use server';
	return withPermissions({ campaign: ['edit'] }, async () => {
		const { id, fromEmail, contentType, templateId, sendAt, ...rest } = params;
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
		await getListmonk().deleteCampaigns(ids);
	});
}

export async function updateCampaignStatus(params: {
	id: number;
	status: 'running' | 'paused' | 'cancelled' | 'scheduled';
}) {
	'use server';
	return withPermissions({ campaign: ['send'] }, async () => {
		return getListmonk().updateCampaignStatus(params.id, params.status);
	});
}

export async function testCampaign(params: { id: number; subscribers: string[] }): Promise<void> {
	'use server';
	return withPermissions({ campaign: ['send'] }, async () => {
		await getListmonk().testCampaign(params.id, params.subscribers);
	});
}
