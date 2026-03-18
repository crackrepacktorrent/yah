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

	// ─── Templates (create + set default) ─────────────────────────────────────

	async createTemplate(params: { name: string; type?: string; subject?: string; body: string }): Promise<ListmonkTemplate> {
		const res = await this.request<{ data: ListmonkTemplate }>('/templates', {
			method: 'POST',
			body: JSON.stringify({
				name: params.name,
				type: params.type ?? 'tx',
				subject: params.subject ?? '',
				body: params.body,
			}),
		});
		return res.data;
	}

	async setDefaultTemplate(id: number): Promise<void> {
		await this.request(`/templates/${id}/default`, { method: 'PUT' });
	}

	// ─── Subscribers ──────────────────────────────────────────────────────────

	async listSubscribers(params: { page?: number; per_page?: number | 'all'; query?: string } = {}): Promise<{ data: { results: ListmonkSubscriber[]; total: number; page: number; per_page: number } }> {
		const qs = new URLSearchParams();
		if (params.page) qs.set('page', String(params.page));
		if (params.per_page) qs.set('per_page', String(params.per_page));
		if (params.query) qs.set('query', params.query);
		const query = qs.toString();
		return this.request(`/subscribers${query ? `?${query}` : ''}`);
	}

	async getSubscriber(id: number): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>(`/subscribers/${id}`);
		return res.data;
	}

	async createSubscriber(params: { email: string; name?: string; status?: string; lists?: number[] }): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>('/subscribers', {
			method: 'POST',
			body: JSON.stringify({
				email: params.email,
				name: params.name ?? '',
				status: params.status ?? 'enabled',
				lists: params.lists,
			}),
		});
		return res.data;
	}

	async updateSubscriber(id: number, params: { email?: string; name?: string; status?: string; lists?: number[] }): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>(`/subscribers/${id}`, {
			method: 'PUT',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async deleteSubscriber(id: number): Promise<void> {
		await this.request(`/subscribers/${id}`, { method: 'DELETE' });
	}

	async blocklistSubscriber(id: number): Promise<void> {
		await this.request('/subscribers/blocklist', {
			method: 'PUT',
			body: JSON.stringify({ ids: [id] }),
		});
	}

	// ─── Lists ────────────────────────────────────────────────────────────────

	async listLists(): Promise<ListmonkList[]> {
		const res = await this.request<{ data: { results: ListmonkList[] } }>('/lists');
		return res.data.results;
	}

	async getList(id: number): Promise<ListmonkList> {
		const res = await this.request<{ data: ListmonkList }>(`/lists/${id}`);
		return res.data;
	}

	async createList(params: { name: string; type: string; optin: string; description?: string }): Promise<ListmonkList> {
		const res = await this.request<{ data: ListmonkList }>('/lists', {
			method: 'POST',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async updateList(id: number, params: { name?: string; type?: string; optin?: string; description?: string }): Promise<ListmonkList> {
		const res = await this.request<{ data: ListmonkList }>(`/lists/${id}`, {
			method: 'PUT',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async deleteList(id: number): Promise<void> {
		await this.request(`/lists/${id}`, { method: 'DELETE' });
	}

	// ─── Bounces ──────────────────────────────────────────────────────────────

	async listBounces(params: { page?: number; per_page?: number | 'all' } = {}): Promise<{ data: { results: ListmonkBounce[]; total: number; page: number; per_page: number } }> {
		const qs = new URLSearchParams();
		if (params.page) qs.set('page', String(params.page));
		if (params.per_page) qs.set('per_page', String(params.per_page));
		const query = qs.toString();
		return this.request(`/bounces${query ? `?${query}` : ''}`);
	}

	async deleteBounce(id: number): Promise<void> {
		await this.request(`/bounces/${id}`, { method: 'DELETE' });
	}

	async deleteAllBounces(): Promise<void> {
		await this.request('/bounces', { method: 'DELETE' });
	}

	// ─── Campaigns ───────────────────────────────────────────────────────────

	async listCampaigns(params: { page?: number; per_page?: number | 'all'; status?: string; query?: string } = {}): Promise<{ data: { results: ListmonkCampaign[]; total: number; page: number; per_page: number } }> {
		const qs = new URLSearchParams();
		if (params.page) qs.set('page', String(params.page));
		if (params.per_page) qs.set('per_page', String(params.per_page));
		if (params.status) qs.set('status', params.status);
		if (params.query) qs.set('query', params.query);
		const query = qs.toString();
		return this.request(`/campaigns${query ? `?${query}` : ''}`);
	}

	async getCampaign(id: number): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>(`/campaigns/${id}`);
		return res.data;
	}

	async createCampaign(params: {
		name: string;
		subject: string;
		from_email?: string;
		lists: number[];
		body: string;
		content_type?: 'richtext' | 'html' | 'markdown' | 'plain';
		template_id?: number;
		tags?: string[];
		send_at?: string;
	}): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>('/campaigns', {
			method: 'POST',
			body: JSON.stringify({
				name: params.name,
				subject: params.subject,
				from_email: params.from_email,
				lists: params.lists,
				body: params.body,
				content_type: params.content_type ?? 'richtext',
				template_id: params.template_id,
				tags: params.tags ?? [],
				send_at: params.send_at,
				type: 'regular',
			}),
		});
		return res.data;
	}

	async updateCampaign(id: number, params: {
		name?: string;
		subject?: string;
		from_email?: string;
		lists: number[];
		body?: string;
		content_type?: 'richtext' | 'html' | 'markdown' | 'plain';
		template_id?: number;
		tags?: string[];
		send_at?: string | null;
	}): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>(`/campaigns/${id}`, {
			method: 'PUT',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async deleteCampaign(id: number): Promise<void> {
		await this.request(`/campaigns/${id}`, { method: 'DELETE' });
	}

	async updateCampaignStatus(id: number, status: 'running' | 'paused' | 'cancelled' | 'scheduled'): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>(`/campaigns/${id}/status`, {
			method: 'PUT',
			body: JSON.stringify({ status }),
		});
		return res.data;
	}

	// ─── Analytics ───────────────────────────────────────────────────────────

	async getAnalytics(params: {
		id?: number;
		type: 'views' | 'clicks' | 'links' | 'bounces';
		from: string;
		to: string;
	}): Promise<ListmonkAnalyticsPoint[]> {
		const qs = new URLSearchParams();
		if (params.id) qs.set('id', String(params.id));
		qs.set('from', params.from);
		qs.set('to', params.to);
		const query = qs.toString();
		const res = await this.request<{ data: ListmonkAnalyticsPoint[] }>(
			`/campaigns/analytics/${params.type}${query ? `?${query}` : ''}`,
		);
		return res.data;
	}

	// ─── Transactional ────────────────────────────────────────────────────────

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
	body_source: string | null;
	is_default: boolean;
}

export interface ListmonkSubscriber {
	id: number;
	created_at: string;
	updated_at: string;
	uuid: string;
	email: string;
	name: string;
	status: 'enabled' | 'disabled' | 'blocklisted';
	lists: { id: number; name: string; subscription_status: string }[];
	attribs: Record<string, unknown>;
}

export interface ListmonkList {
	id: number;
	created_at: string;
	updated_at: string;
	uuid: string;
	name: string;
	type: 'public' | 'private';
	optin: 'single' | 'double';
	description: string;
	subscriber_count: number;
	tags: string[];
	status: 'active' | 'archived';
	subscriber_statuses: Record<string, number>;
}

export interface ListmonkBounce {
	id: number;
	created_at: string;
	type: 'hard' | 'soft' | 'complaint';
	source: string;
	email: string;
	subscriber_id: number;
	campaign_id: number;
	meta: Record<string, unknown>;
}

export interface ListmonkCampaign {
	id: number;
	uuid: string;
	name: string;
	subject: string;
	from_email: string;
	body: string;
	body_source: string | null;
	content_type: 'richtext' | 'html' | 'markdown' | 'plain';
	type: 'regular';
	status: string;
	send_at: string | null;
	started_at: string | null;
	to_send: number;
	sent: number;
	views: number;
	clicks: number;
	bounces: number;
	lists: { id: number; name: string }[];
	tags: string[];
	template_id: number;
	messenger: string;
	archive: boolean;
	archive_slug: string;
	created_at: string;
	updated_at: string;
}

export interface ListmonkAnalyticsPoint {
	campaign_id: number;
	count: number;
	timestamp: string;
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
