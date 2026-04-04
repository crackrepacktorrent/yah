import { query } from '@solidjs/router';
import { getListmonk, type ListmonkTemplate } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listTemplates = query(async (): Promise<{ templates: ListmonkTemplate[] }> => {
	'use server';
	return withPermissions({ template: ['view'] }, async () => {
		const templates = await getListmonk().listTemplates();
		return { templates };
	});
}, 'listTemplates');

export const getTemplate = query(async (id: number) => {
	'use server';
	return withPermissions({ template: ['view'] }, async () => {
		return getListmonk().getTemplate(id);
	});
}, 'getTemplate');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createTemplate(params: {
	name: string;
	type?: string;
	subject?: string;
	body: string;
}) {
	'use server';
	return withPermissions({ template: ['create'] }, async () => {
		return getListmonk().createTemplate(params);
	});
}

export async function updateTemplate(params: {
	id: number;
	name: string;
	subject: string;
	body: string;
}) {
	'use server';
	return withPermissions({ template: ['edit'] }, async () => {
		const { id, ...rest } = params;
		return getListmonk().updateTemplate(id, rest);
	});
}

export async function deleteTemplate(id: number): Promise<void> {
	'use server';
	return withPermissions({ template: ['delete'] }, async () => {
		await getListmonk().deleteTemplate(id);
	});
}

export async function setDefaultTemplate(id: number): Promise<void> {
	'use server';
	return withPermissions({ template: ['set-default'] }, async () => {
		await getListmonk().setDefaultTemplate(id);
	});
}
