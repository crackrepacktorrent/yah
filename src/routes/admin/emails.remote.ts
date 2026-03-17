import { query, command } from '$app/server';
import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { requireRole } from '$lib/server/auth-helpers';

export const listTemplates = query(async () => {
	await requireRole('owner', 'admin');
	const templates = await getListmonk().listTemplates();
	return { templates };
});

export const getTemplate = query(
	v.number(),
	async (id) => {
		await requireRole('owner', 'admin');
		return getListmonk().getTemplate(id);
	},
);

export const deleteTemplate = command(
	v.number(),
	async (id) => {
		await requireRole('owner');
		await getListmonk().deleteTemplate(id);
	},
);

export const updateTemplate = command(
	v.object({
		id: v.number(),
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		subject: v.pipe(v.string(), v.nonEmpty('Subject is required')),
		body: v.pipe(v.string(), v.nonEmpty('Body is required')),
	}),
	async ({ id, name, subject, body }) => {
		await requireRole('owner');
		return getListmonk().updateTemplate(id, { name, subject, body });
	},
);
