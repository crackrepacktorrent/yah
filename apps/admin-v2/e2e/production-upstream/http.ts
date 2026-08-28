import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
	FixtureEmailTemplate,
	FixtureMailingList,
	FixtureMailingListBody,
	FixtureSubscriberMembership,
	FixtureSubscriberActivity,
	FixtureSubscriber,
	FixtureBounce,
	FixtureCampaign,
	FixtureShortlink,
} from './state';
import { fixtureState } from './state';

export function sendJson(response: ServerResponse, value: unknown, status = 200): void {
	response.writeHead(status, { 'content-type': 'application/json' });
	response.end(JSON.stringify(value));
}

export function sendProblem(response: ServerResponse, value: unknown, status: number): void {
	response.writeHead(status, { 'content-type': 'application/problem+json' });
	response.end(JSON.stringify(value));
}

export function sendHtml(response: ServerResponse, value: string): void {
	response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	response.end(value);
}

export function sendPlain(response: ServerResponse, value: string): void {
	response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
	response.end(value);
}

export function hasDateTimeOffset(value: string): boolean {
	return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function periodFactor(url: URL): number {
	const startAt = Number(url.searchParams.get('startAt'));
	const endAt = Number(url.searchParams.get('endAt'));
	const days = (endAt - startAt) / (24 * 60 * 60 * 1000);
	if (days <= 1.1) return 1;
	if (days <= 8) return 7;
	return 30;
}

export function analyticsPayload(url: URL): unknown {
	const factor = periodFactor(url);
	if (url.pathname.endsWith('/stats')) {
		return {
			pageviews: factor * 100,
			visitors: factor * 40,
			visits: factor * 50,
			bounces: factor * 10,
			totaltime: factor * 6_250,
		};
	}
	if (url.pathname.endsWith('/pageviews')) {
		return {
			pageviews: [
				{ x: '2026-08-25T12:00:00.000Z', y: factor * 8 },
				{ x: '2026-08-26T12:00:00.000Z', y: factor * 12 },
			],
			sessions: [{ x: '2026-08-26T12:00:00.000Z', y: factor * 5 }],
		};
	}
	if (url.pathname.endsWith('/metrics')) {
		const type = url.searchParams.get('type');
		const labels: Record<string, string[]> = {
			path: ['/about', '/press'],
			referrer: ['', 'example.test'],
			browser: ['Firefox', 'Chrome'],
			os: ['Linux', 'macOS'],
			device: ['desktop', 'mobile'],
			city: ['Austin', ''],
		};
		return (labels[type ?? ''] ?? []).map((x, index) => ({
			x,
			y: factor * (9 - index),
		}));
	}
	if (url.pathname.endsWith('/active')) return { visitors: 14 };
	return null;
}

export function visitSummary(link: FixtureShortlink) {
	const total = link.visits.length;
	const bots = link.visits.filter(({ potentialBot }) => potentialBot).length;
	return { total, nonBots: total - bots, bots };
}

export function shlinkShortlink(link: FixtureShortlink) {
	return {
		shortCode: link.shortCode,
		shortUrl: `https://y4h.org/${encodeURIComponent(link.shortCode)}`,
		longUrl: link.longUrl,
		dateCreated: link.dateCreated,
		title: link.title,
		tags: link.tags,
		crawlable: link.crawlable,
		forwardQuery: link.forwardQuery,
		hasRedirectRules: false,
		domain: null,
		visitsSummary: visitSummary(link),
		meta: {
			validSince: null,
			validUntil: link.validUntil,
			maxVisits: link.maxVisits,
		},
	};
}

export function pagination(totalItems: number, itemsPerPage: number) {
	return {
		currentPage: 1,
		pagesCount: totalItems === 0 ? 0 : Math.ceil(totalItems / itemsPerPage),
		itemsPerPage,
		itemsInCurrentPage: Math.min(totalItems, itemsPerPage),
		totalItems,
	};
}

export async function requestJson(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	if (!chunks.length) return {};
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

export async function requestText(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks).toString('utf8');
}

export function providerEmailTemplate(template: FixtureEmailTemplate, includeBody = true) {
	return {
		id: template.id,
		name: template.name,
		type: template.type,
		subject: template.subject,
		is_default: template.isDefault,
		created_at: template.createdAt,
		updated_at: template.updatedAt,
		...(includeBody ? { body: template.body, body_source: template.bodySource } : {}),
	};
}

export function providerMailingList(list: FixtureMailingList) {
	return {
		id: list.id,
		uuid: list.uuid,
		name: list.name,
		type: list.type,
		optin: list.optin,
		status: list.status,
		description: list.description,
		tags: list.tags,
		subscriber_count: list.subscriberCount,
		subscriber_statuses: list.subscriberStatuses,
		created_at: list.createdAt,
		updated_at: list.updatedAt,
	};
}

export function providerSubscriberMembership(membership: FixtureSubscriberMembership) {
	const list = fixtureState.mailingLists.find(({ id }) => id === membership.listId);
	if (!list) return null;
	return {
		...providerMailingList(list),
		restricted: membership.restricted,
		subscription_status: membership.status,
		subscription_created_at: membership.createdAt,
		subscription_updated_at: membership.updatedAt,
		subscription_meta: membership.meta,
	};
}

export function providerSubscriber(subscriber: FixtureSubscriber) {
	return {
		id: subscriber.id,
		uuid: subscriber.uuid,
		email: subscriber.email,
		name: subscriber.name,
		status: subscriber.status,
		attribs: subscriber.attribs,
		lists: subscriber.memberships.map(providerSubscriberMembership).filter((membership) => membership !== null),
		created_at: subscriber.createdAt,
		updated_at: subscriber.updatedAt,
	};
}

export function providerSubscriberActivity(activity: FixtureSubscriberActivity) {
	return {
		campaign_views: activity.campaignViews.map((view) => ({
			id: view.campaignId,
			uuid: view.campaignUuid,
			name: view.campaignName,
			subject: view.campaignSubject,
			view_count: view.viewCount,
			last_viewed_at: view.lastViewedAt,
		})),
		link_clicks: activity.linkClicks.map((click) => ({
			link_id: click.linkId,
			url: click.url,
			campaign_id: click.campaignId,
			campaign_uuid: click.campaignUuid,
			campaign_name: click.campaignName,
			campaign_subject: click.campaignSubject,
			click_count: click.clickCount,
			last_clicked_at: click.lastClickedAt,
		})),
	};
}

export function providerBounce(bounce: FixtureBounce) {
	return {
		id: bounce.id,
		type: bounce.type,
		source: bounce.source,
		meta: bounce.meta,
		created_at: bounce.createdAt,
		email: bounce.email,
		subscriber_uuid: bounce.subscriberUuid,
		subscriber_id: bounce.subscriberId,
		subscriber_status: bounce.subscriberStatus,
		campaign: bounce.campaign,
	};
}

export function providerCampaign(campaign: FixtureCampaign, includeBody = true) {
	return {
		id: campaign.id,
		uuid: campaign.uuid,
		type: campaign.type,
		name: campaign.name,
		subject: campaign.subject,
		from_email: campaign.fromEmail,
		body: includeBody ? campaign.body : '',
		body_source: includeBody ? campaign.bodySource : null,
		altbody: campaign.altBody,
		send_at: campaign.sendAt,
		started_at: campaign.startedAt,
		status: campaign.status,
		content_type: campaign.contentType,
		tags: campaign.tags,
		template_id: campaign.templateId,
		messenger: campaign.messenger,
		headers: campaign.headers,
		attribs: campaign.attribs,
		archive: campaign.archive,
		archive_slug: campaign.archiveSlug,
		archive_template_id: campaign.archiveTemplateId,
		archive_meta: campaign.archiveMeta,
		media: campaign.media,
		views: campaign.views,
		clicks: campaign.clicks,
		bounces: campaign.bounces,
		to_send: campaign.toSend,
		sent: campaign.sent,
		lists: campaign.listIds.map((id) => {
			const list = fixtureState.mailingLists.find((candidate) => candidate.id === id);
			return { id: list?.id ?? 0, name: list?.name ?? 'Deleted list' };
		}),
		created_at: campaign.createdAt,
		updated_at: campaign.updatedAt,
	};
}

export function nextMailingListTimestamp(): string {
	fixtureState.mailingListMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 16, 0, fixtureState.mailingListMutationSequence)).toISOString();
}

export function nextCampaignTimestamp(): string {
	fixtureState.campaignMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 17, 0, fixtureState.campaignMutationSequence)).toISOString();
}

export function nextSubscriberTimestamp(): string {
	fixtureState.subscriberMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 18, 0, fixtureState.subscriberMutationSequence)).toISOString();
}

export function nextOptInTimestamp(): string {
	fixtureState.optInRequestSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 19, 0, fixtureState.optInRequestSequence)).toISOString();
}

export function isMailingListType(value: unknown): value is FixtureMailingList['type'] {
	return value === 'public' || value === 'private' || value === 'temporary';
}

export function isMailingListOptIn(value: unknown): value is FixtureMailingList['optin'] {
	return value === 'single' || value === 'double';
}

export function isMailingListStatus(value: unknown): value is FixtureMailingList['status'] {
	return value === 'active' || value === 'archived';
}

export function mailingListBodyIsValid(body: Record<string, unknown>): body is Record<string, unknown> & FixtureMailingListBody {
	return (
		typeof body['name'] === 'string' &&
		isMailingListType(body['type']) &&
		isMailingListOptIn(body['optin']) &&
		isMailingListStatus(body['status']) &&
		typeof body['description'] === 'string' &&
		Array.isArray(body['tags']) &&
		body['tags'].every((tag) => typeof tag === 'string')
	);
}

export function renderEmailTemplate(body: string): string {
	return body.replace(/\{\{\s*template\s+"content"\s*\.\s*\}\}/g, '<article>Fixture campaign content</article>').replace(/\{\{\s*\.Tx\.Data\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>');
}

export function acceptListmonkRequest(request: IncomingMessage, response: ServerResponse): boolean {
	if (request.headers.authorization !== 'token admin:fixture-listmonk-secret') {
		sendJson(response, { message: 'Invalid fixture Listmonk token.' }, 401);
		return false;
	}
	if (fixtureState.failNextListmonkRequest) {
		fixtureState.failNextListmonkRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential listmonk diagnostic');
		return false;
	}
	return true;
}

export function isFixtureRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function storedSecret(next: unknown, current: unknown): unknown {
	if (next === '' && typeof current === 'string') return current;
	return typeof next === 'string' && next ? '•'.repeat([...next].length) : next;
}

export function preserveCollectionSecrets(body: Record<string, unknown>, current: Record<string, unknown>, key: string): void {
	const currentItems = Array.isArray(current[key]) ? current[key] : [];
	const currentByUuid = new Map(currentItems.filter(isFixtureRecord).map((item) => [item['uuid'], item]));
	if (!Array.isArray(body[key])) return;
	body[key] = body[key].map((candidate) => {
		if (!isFixtureRecord(candidate)) return candidate;
		const item = { ...candidate };
		item['password'] = storedSecret(item['password'], currentByUuid.get(item['uuid'])?.['password']);
		return item;
	});
}

export function preserveScalarSecret(body: Record<string, unknown>, current: Record<string, unknown>, key: string): void {
	body[key] = storedSecret(body[key], current[key]);
}

export function preserveNestedSecret(body: Record<string, unknown>, current: Record<string, unknown>, key: string, secretKey: string): void {
	const next = body[key];
	if (!isFixtureRecord(next)) return;
	const currentValue = current[key];
	const currentSecret = isFixtureRecord(currentValue) ? currentValue[secretKey] : undefined;
	body[key] = {
		...next,
		[secretKey]: storedSecret(next[secretKey], currentSecret),
	};
}
