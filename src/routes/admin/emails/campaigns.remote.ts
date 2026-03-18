import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listCampaigns = protectedQuery(
	{ campaign: ['view'] },
	v.optional(v.object({
		page: v.optional(v.number()),
		perPage: v.optional(v.union([v.number(), v.literal('all')])),
		search: v.optional(v.string()),
		status: v.optional(v.string()),
	})),
	async (params) => {
		const { page, perPage, search, status } = params ?? {};
		const res = await getListmonk().listCampaigns({
			page: page ?? 1,
			per_page: perPage ?? 'all',
			query: search || undefined,
			status: status || undefined,
		});
		return {
			campaigns: res.data.results,
			total: res.data.total,
		};
	},
);

export const getCampaign = protectedQuery(
	{ campaign: ['view'] },
	v.number(),
	async (id) => {
		return getListmonk().getCampaign(id);
	},
);

export const createCampaign = protectedCommand(
	{ campaign: ['create'] },
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required')),
		fromEmail: v.optional(v.string()),
		lists: v.array(v.number()),
		body: v.optional(v.string()),
		contentType: v.optional(v.picklist(['richtext', 'html', 'markdown', 'plain'])),
		templateId: v.optional(v.number()),
		tags: v.optional(v.array(v.string())),
		sendAt: v.optional(v.string()),
	}),
	async ({ name, subject, fromEmail, lists, body, contentType, templateId, tags, sendAt }) => {
		return getListmonk().createCampaign({
			name,
			subject,
			from_email: fromEmail,
			lists,
			body: body ?? '',
			content_type: contentType,
			template_id: templateId,
			tags,
			send_at: sendAt,
		});
	},
);

export const updateCampaign = protectedCommand(
	{ campaign: ['edit'] },
	v.object({
		id: v.number(),
		name: v.optional(v.string()),
		subject: v.optional(v.string()),
		fromEmail: v.optional(v.string()),
		lists: v.array(v.number()),
		body: v.optional(v.string()),
		contentType: v.optional(v.picklist(['richtext', 'html', 'markdown', 'plain'])),
		templateId: v.optional(v.number()),
		tags: v.optional(v.array(v.string())),
		sendAt: v.optional(v.nullable(v.string())),
	}),
	async ({ id, name, subject, fromEmail, lists, body, contentType, templateId, tags, sendAt }) => {
		return getListmonk().updateCampaign(id, {
			name,
			subject,
			from_email: fromEmail,
			lists,
			body,
			content_type: contentType,
			template_id: templateId,
			tags,
			send_at: sendAt,
		});
	},
);

export const deleteCampaign = protectedCommand(
	{ campaign: ['delete'] },
	v.number(),
	async (id) => {
		await getListmonk().deleteCampaign(id);
	},
);

export const getCampaignAnalytics = protectedQuery(
	{ campaign: ['view'] },
	v.object({
		campaignId: v.optional(v.number()),
		type: v.picklist(['views', 'clicks']),
		from: v.string(),
		to: v.string(),
	}),
	async ({ campaignId, type, from, to }) => {
		return getListmonk().getAnalytics({
			id: campaignId,
			type,
			from,
			to,
		});
	},
);

export const previewCampaign = protectedQuery(
	{ campaign: ['view'] },
	v.number(),
	async (id) => {
		return getListmonk().previewCampaign(id);
	},
);

export const testCampaign = protectedCommand(
	{ campaign: ['send'] },
	v.object({
		id: v.number(),
		subscribers: v.array(v.pipe(v.string(), v.nonEmpty())),
	}),
	async ({ id, subscribers }) => {
		await getListmonk().testCampaign(id, subscribers);
	},
);

export const updateCampaignStatus = protectedCommand(
	{ campaign: ['send'] },
	v.object({
		id: v.number(),
		status: v.picklist(['running', 'paused', 'cancelled', 'scheduled']),
	}),
	async ({ id, status }) => {
		return getListmonk().updateCampaignStatus(id, status);
	},
);
