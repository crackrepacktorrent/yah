// ─── Client ──────────────────────────────────────────────────────────────────

import { env } from '~/server/env';
import { fetchUpstream, parseJsonResponse, readErrorBody } from '~/server/upstream-http';

class ListmonkClient {
	private baseUrl: string;
	private authHeader: string;

	constructor() {
		this.baseUrl = env.LISTMONK_URL.replace(/\/+$/, '');
		this.authHeader = `token ${env.LISTMONK_API_TOKEN}`;
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const res = await fetchUpstream(`${this.baseUrl}/api${path}`, {
			...options,
			headers: {
				Authorization: this.authHeader,
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!res.ok) {
			const { json, text } = await readErrorBody(res);
			let message = `Listmonk API error: ${res.status} ${res.statusText}`;
			if (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string') {
				message = json.message;
			} else if (text) message += ` — ${text}`;
			throw new ListmonkApiError(message, res.status);
		}

		return parseJsonResponse<T>(res, 'Listmonk');
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

	async listSubscribers(params: { page?: number; per_page?: number | 'all'; query?: string } = {}): Promise<{
		data: { results: ListmonkSubscriber[]; total: number; page: number; per_page: number };
	}> {
		const qs = new URLSearchParams();
		if (params.page) qs.set('page', String(params.page));
		if (params.per_page) qs.set('per_page', String(params.per_page));
		if (params.query) qs.set('query', params.query);
		const query = qs.toString();
		return this.request(`/subscribers${query ? `?${query}` : ''}`);
	}

	async getSubscriberExport(id: number): Promise<ListmonkSubscriberExport> {
		return this.request(`/subscribers/${id}/export`);
	}

	async getSubscriber(id: number): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>(`/subscribers/${id}`);
		return res.data;
	}

	async createSubscriber(params: {
		email: string;
		name?: string;
		status?: string;
		lists?: number[];
		preconfirm?: boolean;
	}): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>('/subscribers', {
			method: 'POST',
			body: JSON.stringify({
				email: params.email,
				name: params.name ?? '',
				status: params.status ?? 'enabled',
				lists: params.lists,
				preconfirm_subscriptions: params.preconfirm ?? false,
			}),
		});
		return res.data;
	}

	async updateSubscriber(
		id: number,
		params: {
			email?: string;
			name?: string;
			status?: string;
			lists?: number[];
			preconfirm?: boolean;
		},
	): Promise<ListmonkSubscriber> {
		const res = await this.request<{ data: ListmonkSubscriber }>(`/subscribers/${id}`, {
			method: 'PUT',
			body: JSON.stringify({
				...params,
				preconfirm_subscriptions: params.preconfirm ?? false,
			}),
		});
		return res.data;
	}

	async deleteSubscribers(ids: number[]): Promise<void> {
		const qs = ids.map((id) => `id=${id}`).join('&');
		await this.request(`/subscribers?${qs}`, { method: 'DELETE' });
	}

	async getSubscriberBounces(id: number): Promise<ListmonkBounce[]> {
		const res = await this.request<{ data: ListmonkBounce[] }>(`/subscribers/${id}/bounces`);
		return res.data;
	}

	async deleteSubscriberBounces(id: number): Promise<void> {
		await this.request(`/subscribers/${id}/bounces`, { method: 'DELETE' });
	}

	async blocklistSubscribers(ids: number[]): Promise<void> {
		await this.request('/subscribers/blocklist', {
			method: 'PUT',
			body: JSON.stringify({ ids }),
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

	async deleteLists(ids: number[]): Promise<void> {
		const qs = ids.map((id) => `id=${id}`).join('&');
		await this.request(`/lists?${qs}`, { method: 'DELETE' });
	}

	// ─── Bounces ──────────────────────────────────────────────────────────────

	async listBounces(params: { page?: number; per_page?: number | 'all' } = {}): Promise<{
		data: { results: ListmonkBounce[]; total: number; page: number; per_page: number };
	}> {
		const qs = new URLSearchParams();
		if (params.page) qs.set('page', String(params.page));
		if (params.per_page) qs.set('per_page', String(params.per_page));
		const query = qs.toString();
		return this.request(`/bounces${query ? `?${query}` : ''}`);
	}

	async deleteBounces(ids: number[]): Promise<void> {
		const qs = ids.map((id) => `id=${id}`).join('&');
		await this.request(`/bounces?${qs}`, { method: 'DELETE' });
	}

	async deleteAllBounces(): Promise<void> {
		await this.request('/bounces?all=true', { method: 'DELETE' });
	}

	// ─── Campaigns ───────────────────────────────────────────────────────────

	async listCampaigns(params: { page?: number; per_page?: number | 'all'; status?: string; query?: string } = {}): Promise<{
		data: { results: ListmonkCampaign[]; total: number; page: number; per_page: number };
	}> {
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

	async updateCampaign(
		id: number,
		params: {
			name?: string;
			subject?: string;
			from_email?: string;
			lists: number[];
			body?: string;
			content_type?: 'richtext' | 'html' | 'markdown' | 'plain';
			template_id?: number;
			tags?: string[];
			send_at?: string | null;
		},
	): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>(`/campaigns/${id}`, {
			method: 'PUT',
			body: JSON.stringify(params),
		});
		return res.data;
	}

	async deleteCampaigns(ids: number[]): Promise<void> {
		const qs = ids.map((id) => `id=${id}`).join('&');
		await this.request(`/campaigns?${qs}`, { method: 'DELETE' });
	}

	async updateCampaignStatus(id: number, status: 'running' | 'paused' | 'cancelled' | 'scheduled'): Promise<ListmonkCampaign> {
		const res = await this.request<{ data: ListmonkCampaign }>(`/campaigns/${id}/status`, {
			method: 'PUT',
			body: JSON.stringify({ status }),
		});
		return res.data;
	}

	// ─── Campaign Preview & Test ─────────────────────────────────────────────

	async previewCampaign(id: number): Promise<string> {
		const res = await fetchUpstream(`${this.baseUrl}/api/campaigns/${id}/preview`, {
			headers: { Authorization: this.authHeader },
		});
		if (!res.ok) {
			throw new ListmonkApiError(`Preview failed: ${res.status}`, res.status);
		}
		return res.text();
	}

	async testCampaign(id: number, subscribers: string[]): Promise<void> {
		await this.request(`/campaigns/${id}/test`, {
			method: 'POST',
			body: JSON.stringify({ subscribers }),
		});
	}

	// ─── Subscriber Opt-in ───────────────────────────────────────────────────

	async sendOptinConfirmation(subscriberId: number): Promise<void> {
		await this.request(`/subscribers/${subscriberId}/optin`, {
			method: 'POST',
		});
	}

	// ─── Analytics ───────────────────────────────────────────────────────────

	async getAnalytics(params: {
		id: number;
		type: 'views' | 'clicks' | 'links' | 'bounces';
		from: string;
		to: string;
	}): Promise<ListmonkAnalyticsPoint[]> {
		const qs = new URLSearchParams();
		qs.set('id', String(params.id));
		qs.set('from', params.from);
		qs.set('to', params.to);
		const res = await this.request<{ data: ListmonkAnalyticsPoint[] }>(`/campaigns/analytics/${params.type}?${qs.toString()}`);
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

	// ─── Settings ──────────────────────────────────────────────────────────

	async getSettings(): Promise<ListmonkSettings> {
		const res = await this.request<{ data: ListmonkSettings }>('/settings');
		return res.data;
	}

	/** Fetch settings as raw untyped JSON so no fields are lost during merge. */
	async getRawSettings(): Promise<Record<string, unknown>> {
		const res = await this.request<{ data: Record<string, unknown> }>('/settings');
		return res.data;
	}

	async updateSettings(settings: Record<string, unknown>): Promise<void> {
		await this.request('/settings', {
			method: 'PUT',
			body: JSON.stringify(settings),
		});
	}

	async updateSettingsByKey(key: string, value: unknown): Promise<void> {
		await this.request(`/settings/${key}`, {
			method: 'PUT',
			body: JSON.stringify(value),
		});
	}

	async testSmtp(config: ListmonkSmtpConfig & { email: string }): Promise<string[]> {
		const res = await this.request<{ data: string[] }>('/settings/smtp/test', {
			method: 'POST',
			body: JSON.stringify(config),
		});
		return res.data;
	}

	async getLogs(): Promise<string[]> {
		const res = await this.request<{ data: string[] }>('/logs');
		return res.data;
	}

	/** Returns the URL for the SSE event stream (caller handles EventSource). */
	get eventsUrl(): string {
		return `${this.baseUrl}/api/events`;
	}

	get eventsAuthHeader(): string {
		return this.authHeader;
	}
}

// ─── Settings Types ──────────────────────────────────────────────────────────

export interface ListmonkSmtpConfig {
	uuid: string;
	enabled: boolean;
	host: string;
	port: number;
	auth_protocol: 'login' | 'cram' | 'plain' | 'none';
	username: string;
	password: string;
	email_headers: { key: string; value: string }[];
	hello_hostname: string;
	max_conns: number;
	max_msg_retries: number;
	idle_timeout: string;
	wait_timeout: string;
	tls_type: 'TLS' | 'STARTTLS' | 'none';
	tls_skip_verify: boolean;
}

export interface ListmonkBounceAction {
	count: number;
	action: 'blocklist' | 'delete' | 'none';
}

export interface ListmonkSettings {
	smtp: ListmonkSmtpConfig[];
	'app.site_name': string;
	'app.root_url': string;
	'app.logo_url': string;
	'app.favicon_url': string;
	'app.from_email': string;
	'app.notify_emails': string[];
	'app.enable_public_subscription_page': boolean;
	'app.enable_public_archive': boolean;
	'app.enable_public_archive_rss_content': boolean;
	'app.send_optin_confirmation': boolean;
	'app.check_updates': boolean;
	'app.lang': string;
	'app.batch_size': number;
	'app.concurrency': number;
	'app.max_send_errors': number;
	'app.message_rate': number;
	'app.message_sliding_window': boolean;
	'app.message_sliding_window_duration': string;
	'app.message_sliding_window_rate': number;
	'privacy.individual_tracking': boolean;
	'privacy.unsubscribe_header': boolean;
	'privacy.allow_blocklist': boolean;
	'privacy.allow_preferences': boolean;
	'privacy.allow_export': boolean;
	'privacy.allow_wipe': boolean;
	'privacy.exportable': string[];
	'privacy.record_optin_ip': boolean;
	'privacy.domain_blocklist': string[];
	'privacy.domain_allowlist': string[];
	'bounce.enabled': boolean;
	'bounce.webhooks_enabled': boolean;
	'bounce.actions': {
		complaint: ListmonkBounceAction;
		hard: ListmonkBounceAction;
		soft: ListmonkBounceAction;
	};
	'bounce.ses_enabled': boolean;
	'bounce.sendgrid_enabled': boolean;
	'bounce.sendgrid_key': string;
	'bounce.postmark': { enabled: boolean; username: string; password: string };
	'bounce.forwardemail': { enabled: boolean; key: string };
	[key: string]: unknown;
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
	lists: {
		id: number;
		name: string;
		subscription_status: string;
		subscription_created_at?: string;
		subscription_updated_at?: string;
		optin?: string;
		type?: string;
	}[];
	attribs: Record<string, unknown>;
}

export interface ListmonkSubscriberExport {
	profile: ListmonkSubscriber[];
	subscriptions: { subscription_status: string; name: string; type: string; created_at: string }[];
	campaign_views: { campaign_id: number; name: string; subject: string; count: number }[];
	link_clicks: { campaign_id: number; url: string; count: number }[];
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
