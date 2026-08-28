import { query } from '@solidjs/router';
import { getListmonk, type ListmonkTemplate } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';
import {
	CreateTemplateInputSchema,
	TemplateIdSchema,
	UpdateTemplateInputSchema,
	type CreateTemplateInput,
	type UpdateTemplateInput,
} from '~/lib/admin-contracts';
import { parseInput } from '~/server/validation';

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
		return getListmonk().getTemplate(parseInput(TemplateIdSchema, id));
	});
}, 'getTemplate');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createTemplate(params: CreateTemplateInput) {
	'use server';
	return withPermissions({ template: ['create'] }, async () => {
		return getListmonk().createTemplate(parseInput(CreateTemplateInputSchema, params));
	});
}

export async function updateTemplate(params: UpdateTemplateInput) {
	'use server';
	return withPermissions({ template: ['edit'] }, async () => {
		const { id, ...rest } = parseInput(UpdateTemplateInputSchema, params);
		return getListmonk().updateTemplate(id, rest);
	});
}

export async function deleteTemplate(id: number): Promise<void> {
	'use server';
	return withPermissions({ template: ['delete'] }, async () => {
		await getListmonk().deleteTemplate(parseInput(TemplateIdSchema, id));
	});
}

export async function setDefaultTemplate(id: number): Promise<void> {
	'use server';
	return withPermissions({ template: ['set-default'] }, async () => {
		await getListmonk().setDefaultTemplate(parseInput(TemplateIdSchema, id));
	});
}
