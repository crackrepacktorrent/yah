import 'server-only';
import { providerInvariantError } from '~/integrations/provider-contract.server';
import * as v from 'valibot';
import {
	TemplateProviderFailure,
	type EmailTemplateDetail,
	type EmailTemplateKind,
	type EmailTemplateSummary,
} from '~/features/email-templates/contracts';
import type { EmailTemplateManager } from '~/features/email-templates/service';
import { createProviderResponseParser } from '~/integrations/provider-response.server';
import type { ProductionConfig } from '~/platform/config/production';
import {
	createListmonkTransport,
	ListmonkHttpFailure,
	type ListmonkRequest,
} from './transport.server';

const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const dateText = v.pipe(v.string(), v.check((value) => !Number.isNaN(Date.parse(value))));
const templateKindSchema = v.picklist(['tx', 'campaign', 'campaign_visual'] as const);
const templateSummarySchema = v.object({
	id: positiveInteger,
	created_at: dateText,
	updated_at: dateText,
	name: v.string(),
	subject: v.string(),
	type: templateKindSchema,
	is_default: v.boolean(),
});
const templateDetailSchema = v.object({
	...templateSummarySchema.entries,
	body: v.string(),
	body_source: v.optional(v.nullable(v.string())),
});
const templateListResponseSchema = v.object({ data: v.array(templateSummarySchema) });
const templateDetailResponseSchema = v.object({ data: templateDetailSchema });
const deleteResponseSchema = v.object({ data: v.literal(true) });

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type TemplateSummaryDto = v.InferOutput<typeof templateSummarySchema>;
type TemplateDetailDto = v.InferOutput<typeof templateDetailSchema>;
const parse = createProviderResponseParser('Listmonk');

function normalizeSummary(value: TemplateSummaryDto): EmailTemplateSummary {
	return {
		id: value.id,
		name: value.name,
		kind: value.type as EmailTemplateKind,
		subject: value.subject,
		isDefault: value.is_default,
		createdAt: value.created_at,
		updatedAt: value.updated_at,
	};
}

function normalizeDetail(value: TemplateDetailDto): EmailTemplateDetail {
	return {
		...normalizeSummary(value),
		body: value.body,
		hasVisualSource: typeof value.body_source === 'string' && value.body_source.length > 0,
	};
}

async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ListmonkHttpFailure) throw new TemplateProviderFailure(error.status);
		throw error;
	}
}

export function createListmonkTemplateManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): EmailTemplateManager {
	const transport = createListmonkTransport(config, request);

	async function get(id: number): Promise<EmailTemplateDetail | null> {
		try {
			const response = await transport.json(`/templates/${id}`);
			return normalizeDetail(parse(templateDetailResponseSchema, response, 'template-detail').data);
		} catch (error) {
			// Listmonk v6 reports a missing, valid numeric template ID as 400. Keep
			// that provider-specific quirk inside the adapter and expose a normal
			// nullable lookup to the feature service.
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			if (error instanceof ListmonkHttpFailure) throw new TemplateProviderFailure(error.status);
			throw error;
		}
	}

	return {
		async list(): Promise<EmailTemplateSummary[]> {
			return providerCall(async () => {
				const response = parse(
					templateListResponseSchema,
					await transport.json('/templates?no_body=true'),
					'template-list',
				);
				return response.data.map(normalizeSummary);
			});
		},
		get,
		async create(input): Promise<EmailTemplateDetail> {
			return providerCall(async () => {
				const response = await transport.json('/templates', {
					method: 'POST',
					body: JSON.stringify({
						name: input.name,
						type: input.kind,
						subject: input.subject,
						body: input.body,
					}),
				});
				return normalizeDetail(parse(templateDetailResponseSchema, response, 'created-template').data);
			});
		},
		async update(input): Promise<void> {
			await providerCall(async () => {
				const response = await transport.json(`/templates/${input.id}`, {
					method: 'PUT',
					body: JSON.stringify({ name: input.name, subject: input.subject, body: input.body }),
				});
				parse(templateDetailResponseSchema, response, 'updated-template');
			});
		},
		async delete(id): Promise<void> {
			await providerCall(async () => {
				const response = await transport.json(`/templates/${id}`, { method: 'DELETE' });
				parse(deleteResponseSchema, response, 'deleted-template');
			});
		},
		async setDefault(id): Promise<void> {
			await providerCall(async () => {
				const response = await transport.json(`/templates/${id}/default`, { method: 'PUT' });
				const templates = parse(templateListResponseSchema, response, 'default-template').data;
				if (!templates.some((template) => template.id === id && template.is_default)) {
					throw providerInvariantError('Listmonk returned an invalid default-template response.');
				}
			});
		},
		async previewSaved(id): Promise<string> {
			return providerCall(() => transport.html(`/templates/${id}/preview`));
		},
		async previewDraft(input): Promise<string> {
			return providerCall(() => {
				const body = new URLSearchParams({ template_type: input.kind, body: input.body });
				return transport.html('/templates/preview', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
					body,
				});
			});
		},
	};
}
