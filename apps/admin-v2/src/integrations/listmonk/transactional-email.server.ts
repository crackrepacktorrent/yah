import 'server-only';
import type { ProductionConfig } from '~/platform/config/production';
import { fetchUpstream, parseJsonResponse, readErrorBody } from '~/integrations/http';

export interface TransactionalEmail {
	subscriberEmail: string;
	templateId: number;
	data?: Record<string, unknown>;
	fromEmail?: string;
}

export interface TransactionalMailer {
	send(message: TransactionalEmail): Promise<void>;
}

export function createListmonkTransactionalMailer(
	config: Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>,
): TransactionalMailer {
	return {
		async send(message) {
			const response = await fetchUpstream(`${config.LISTMONK_URL}/api/tx`, {
				method: 'POST',
				headers: {
					Authorization: `token ${config.LISTMONK_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					subscriber_email: message.subscriberEmail,
					subscriber_mode: 'external',
					template_id: message.templateId,
					data: message.data,
					from_email: message.fromEmail,
					content_type: 'html',
				}),
			});
			if (!response.ok) {
				const { json, text } = await readErrorBody(response);
				const detail =
					json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
						? json.message
						: text || response.statusText;
				throw new Error(`Listmonk transactional email failed (${response.status}): ${detail}`);
			}
			await parseJsonResponse<unknown>(response, 'Listmonk');
		},
	};
}
