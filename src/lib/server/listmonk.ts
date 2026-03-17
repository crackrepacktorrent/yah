import { env } from '$env/dynamic/private';

// ─── Client ──────────────────────────────────────────────────────────────────

class ListmonkClient {
	private baseUrl: string;
	private authHeader: string;

	constructor() {
		const url = env.LISTMONK_URL;
		const username = env.LISTMONK_USERNAME;
		const password = env.LISTMONK_PASSWORD;
		if (!url || !username || !password) {
			throw new Error('LISTMONK_URL, LISTMONK_USERNAME, and LISTMONK_PASSWORD must be set');
		}
		this.baseUrl = url.replace(/\/+$/, '');
		this.authHeader = 'Basic ' + btoa(`${username}:${password}`);
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const res = await fetch(`${this.baseUrl}/api${path}`, {
			...options,
			headers: {
				Authorization: this.authHeader,
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new ListmonkApiError(
				`Listmonk API error: ${res.status} ${res.statusText} — ${text}`,
				res.status,
			);
		}

		return res.json();
	}

	async listTemplates(): Promise<ListmonkTemplate[]> {
		const res = await this.request<{ data: ListmonkTemplate[] }>('/templates');
		return res.data;
	}

	async getTemplate(id: number): Promise<ListmonkTemplate> {
		const res = await this.request<{ data: ListmonkTemplate }>(`/templates/${id}`);
		return res.data;
	}

	async deleteTemplate(id: number): Promise<void> {
		await this.request(`/templates/${id}`, { method: 'DELETE' });
	}

	async updateTemplate(id: number, params: { name: string; subject: string; body: string }): Promise<ListmonkTemplate> {
		const res = await this.request<{ data: ListmonkTemplate }>(`/templates/${id}`, {
			method: 'PUT',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async sendTransactionalEmail(params: {
		subscriberEmail: string;
		templateId: number;
		data?: Record<string, unknown>;
		fromEmail?: string;
	}): Promise<void> {
		await this.request('/tx', {
			method: 'POST',
			body: JSON.stringify({
				subscriber_email: params.subscriberEmail,
				subscriber_mode: 'external',
				template_id: params.templateId,
				data: params.data,
				from_email: params.fromEmail,
				content_type: 'html',
			}),
		});
	}
}

export interface ListmonkTemplate {
	id: number;
	created_at: string;
	updated_at: string;
	name: string;
	subject: string;
	type: 'campaign' | 'tx' | 'campaign_visual';
	body: string;
	is_default: boolean;
}

export class ListmonkApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = 'ListmonkApiError';
		this.status = status;
	}
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _client: ListmonkClient | null = null;

export function getListmonk(): ListmonkClient {
	if (!_client) {
		_client = new ListmonkClient();
	}
	return _client;
}
