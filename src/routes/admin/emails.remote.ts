import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listTemplates = protectedQuery({ template: ['view'] }, async () => {
	const templates = await getListmonk().listTemplates();
	return { templates };
});

export const getTemplate = protectedQuery(
	{ template: ['view'] },
	v.number(),
	async (id) => {
		return getListmonk().getTemplate(id);
	},
);

export const deleteTemplate = protectedCommand(
	{ template: ['delete'] },
	v.number(),
	async (id) => {
		await getListmonk().deleteTemplate(id);
	},
);

export const updateTemplate = protectedCommand(
	{ template: ['edit'] },
	v.object({
		id: v.number(),
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required')),
		body: v.pipe(v.string(), v.nonEmpty('Body is required')),
	}),
	async ({ id, name, subject, body }) => {
		return getListmonk().updateTemplate(id, { name, subject, body });
	},
);

export const createTemplate = protectedCommand(
	{ template: ['create'] },
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		type: v.optional(v.string()),
		subject: v.optional(v.string()),
		body: v.pipe(v.string(), v.nonEmpty('Body is required')),
	}),
	async ({ name, type, subject, body }) => {
		return getListmonk().createTemplate({ name, type, subject, body });
	},
);

export const setDefaultTemplate = protectedCommand(
	{ template: ['set-default'] },
	v.number(),
	async (id) => {
		await getListmonk().setDefaultTemplate(id);
	},
);
