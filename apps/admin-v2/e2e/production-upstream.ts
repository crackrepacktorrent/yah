import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const port = 43124;
const farFutureToken = `header.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url')}.fixture`;
const shlinkApiKey = 'fixture-shlink-secret';
let failNextUmamiRequest = false;
let failNextShlinkRequest = false;
let failNextListmonkRequest = false;
let failNextCampaignAnalyticsRequest = false;
let transactionalMessages: Record<string, unknown>[] = [];

type FixtureEmailTemplate = {
	id: number;
	name: string;
	type: 'tx' | 'campaign' | 'campaign_visual';
	subject: string;
	body: string;
	bodySource: string | null;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
};

function initialEmailTemplates(): FixtureEmailTemplate[] {
	return [
		{
			id: 1,
			name: 'Default campaign',
			type: 'campaign',
			subject: '',
			body: '<main>{{ template "content" . }}</main>',
			bodySource: null,
			isDefault: true,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-02T00:00:00Z',
		},
		{
			id: 4,
			name: 'Visual newsletter',
			type: 'campaign_visual',
			subject: '',
			body: '<section>Visual fixture preview</section>',
			bodySource: JSON.stringify({ root: { type: 'container', children: [] } }),
			isDefault: false,
			createdAt: '2026-01-15T00:00:00Z',
			updatedAt: '2026-01-16T00:00:00Z',
		},
		{
			id: 5,
			name: 'Admin access',
			type: 'tx',
			subject: 'Your admin access link',
			body: '<a href="{{ .Tx.Data.access_link }}">Open admin</a>',
			bodySource: null,
			isDefault: false,
			createdAt: '2026-02-01T00:00:00Z',
			updatedAt: '2026-02-02T00:00:00Z',
		},
		{
			id: 6,
			name: 'Password reset',
			type: 'tx',
			subject: 'Reset your password',
			body: '<a href="{{ .Tx.Data.reset_link }}">Reset password</a>',
			bodySource: null,
			isDefault: false,
			createdAt: '2026-03-01T00:00:00Z',
			updatedAt: '2026-03-02T00:00:00Z',
		},
	];
}

let emailTemplates = initialEmailTemplates();

type FixtureMailingList = {
	id: number;
	uuid: string;
	name: string;
	type: 'public' | 'private' | 'temporary';
	optin: 'single' | 'double';
	status: 'active' | 'archived';
	description: string;
	tags: string[];
	subscriberCount: number;
	subscriberStatuses: Record<string, number>;
	createdAt: string;
	updatedAt: string;
};

type FixtureMailingListBody = Pick<FixtureMailingList, 'name' | 'type' | 'optin' | 'status' | 'description' | 'tags'>;

function initialMailingLists(): FixtureMailingList[] {
	return [
		{
			id: 11,
			uuid: '00000000-0000-4000-8000-000000000011',
			name: 'Press announcements',
			type: 'public',
			optin: 'double',
			status: 'active',
			description: 'Public announcements for journalists and supporters.',
			tags: ['press', 'announcements'],
			subscriberCount: 42,
			subscriberStatuses: { confirmed: 39, unconfirmed: 3, unsubscribed: 4 },
			createdAt: '2026-01-10T12:00:00Z',
			updatedAt: '2026-08-20T14:00:00Z',
		},
		{
			id: 12,
			uuid: '00000000-0000-4000-8000-000000000012',
			name: 'Volunteer coordination',
			type: 'private',
			optin: 'single',
			status: 'active',
			description: 'Internal updates for active volunteers.',
			tags: ['volunteers', 'internal'],
			subscriberCount: 18,
			subscriberStatuses: { confirmed: 18, unconfirmed: 0, unsubscribed: 1 },
			createdAt: '2026-02-10T12:00:00Z',
			updatedAt: '2026-08-21T14:00:00Z',
		},
		{
			id: 13,
			uuid: '00000000-0000-4000-8000-000000000013',
			name: 'Archived community bulletin',
			type: 'public',
			optin: 'double',
			status: 'archived',
			description: 'Previous community bulletin subscribers.',
			tags: ['community', 'archive'],
			subscriberCount: 73,
			subscriberStatuses: { confirmed: 70, unconfirmed: 3, unsubscribed: 9 },
			createdAt: '2025-05-01T12:00:00Z',
			updatedAt: '2026-04-01T14:00:00Z',
		},
		{
			id: 14,
			uuid: '00000000-0000-4000-8000-000000000014',
			name: 'Campaign import 2026-08',
			type: 'temporary',
			optin: 'single',
			status: 'active',
			description: 'Listmonk-managed temporary campaign list.',
			tags: ['temporary', 'campaign-import'],
			subscriberCount: 7,
			subscriberStatuses: { confirmed: 7, unconfirmed: 0 },
			createdAt: '2026-08-24T12:00:00Z',
			updatedAt: '2026-08-24T12:00:00Z',
		},
	];
}

let mailingLists = initialMailingLists();
let nextMailingListId = 15;
let mailingListMutationSequence = 0;

type FixtureSubscriptionStatus = 'unconfirmed' | 'confirmed' | 'unsubscribed';

type FixtureSubscriberMembership = {
	listId: number;
	status: FixtureSubscriptionStatus;
	restricted: boolean;
	meta: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

type FixtureSubscriberActivity = {
	campaignViews: Array<{
		campaignId: number;
		campaignUuid: string;
		campaignName: string;
		campaignSubject: string;
		viewCount: number;
		lastViewedAt: string;
	}>;
	linkClicks: Array<{
		linkId: number;
		url: string;
		campaignId: number | null;
		campaignUuid: string | null;
		campaignName: string | null;
		campaignSubject: string | null;
		clickCount: number;
		lastClickedAt: string;
	}>;
};

type FixtureSubscriber = {
	id: number;
	uuid: string;
	email: string;
	name: string;
	status: 'enabled' | 'disabled' | 'blocklisted';
	attribs: Record<string, unknown>;
	memberships: FixtureSubscriberMembership[];
	activity: FixtureSubscriberActivity;
	createdAt: string;
	updatedAt: string;
};

type FixtureOptInRequest = {
	subscriberId: number;
	requestedAt: string;
};

const emptySubscriberActivity = (): FixtureSubscriberActivity => ({ campaignViews: [], linkClicks: [] });

function fixtureMembership(
	listId: number,
	status: FixtureSubscriptionStatus,
	overrides: Partial<Omit<FixtureSubscriberMembership, 'listId' | 'status'>> = {},
): FixtureSubscriberMembership {
	return {
		listId,
		status,
		restricted: false,
		meta: {},
		createdAt: '2026-06-01T12:00:00Z',
		updatedAt: '2026-08-20T12:00:00Z',
		...overrides,
	};
}

function initialSubscribers(): FixtureSubscriber[] {
	const subscribers = Array.from({ length: 58 }, (_, index): FixtureSubscriber => {
		const id = 101 + index;
		return {
			id,
			uuid: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			email: `supporter-${id}@example.test`,
			name: `Fixture Supporter ${id}`,
			status: 'enabled',
			attribs: { source: 'fixture', cohort: id % 2 === 0 ? 'even' : 'odd' },
			memberships: [fixtureMembership(11, 'confirmed')],
			activity: emptySubscriberActivity(),
			createdAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
			updatedAt: '2026-08-24T12:00:00Z',
		};
	});

	const byId = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]));
	Object.assign(byId.get(158) as FixtureSubscriber, {
		email: 'ada.supporter@example.test',
		name: 'Ada Supporter',
		attribs: {
			source: 'community-event',
			preferences: { format: 'html', topics: ['press', 'volunteering'] },
			profile: { chapter: 'Austin', yearsActive: 3 },
		},
		memberships: [
			fixtureMembership(11, 'confirmed', { meta: { source: 'signup-form', verified: true } }),
			fixtureMembership(12, 'confirmed', { meta: { coordinator: 'Sam' } }),
		],
		activity: {
			campaignViews: [{
				campaignId: 21,
				campaignUuid: '00000000-0000-4000-8000-000000000021',
				campaignName: 'August supporter update',
				campaignSubject: 'What happened in August',
				viewCount: 3,
				lastViewedAt: '2026-08-26T15:30:00Z',
			}],
			linkClicks: [
				{
					linkId: 301,
					url: 'https://example.test/press',
					campaignId: 21,
					campaignUuid: '00000000-0000-4000-8000-000000000021',
					campaignName: 'August supporter update',
					campaignSubject: 'What happened in August',
					clickCount: 2,
					lastClickedAt: '2026-08-26T15:35:00Z',
				},
				{
					linkId: 302,
					url: 'https://example.test/preferences',
					campaignId: null,
					campaignUuid: null,
					campaignName: null,
					campaignSubject: null,
					clickCount: 1,
					lastClickedAt: '2026-08-25T14:00:00Z',
				},
			],
		},
	});
	Object.assign(byId.get(157) as FixtureSubscriber, {
		email: 'disabled.member@example.test',
		name: 'Disabled Member',
		status: 'disabled',
		attribs: { source: 'manual-import', disabledReason: 'address review' },
		memberships: [fixtureMembership(12, 'confirmed')],
	});
	Object.assign(byId.get(156) as FixtureSubscriber, {
		email: 'blocklisted.member@example.test',
		name: 'Blocklisted Member',
		status: 'blocklisted',
		attribs: { source: 'complaint' },
		memberships: [
			fixtureMembership(11, 'unsubscribed', { meta: { reason: 'complaint' } }),
			fixtureMembership(13, 'unsubscribed', { meta: { reason: 'complaint' } }),
		],
	});
	Object.assign(byId.get(155) as FixtureSubscriber, {
		email: 'pending.member@example.test',
		name: 'Pending Double Opt-in',
		attribs: { source: 'press-signup' },
		memberships: [
			fixtureMembership(11, 'unconfirmed', { meta: { source: 'press-signup' } }),
			fixtureMembership(12, 'confirmed'),
		],
	});
	Object.assign(byId.get(154) as FixtureSubscriber, {
		email: 'protected.member@example.test',
		name: 'Protected Memberships',
		attribs: { source: 'migration', providerOwned: { retain: true } },
		memberships: [
			fixtureMembership(12, 'confirmed', { restricted: true, meta: { providerOwned: true } }),
			fixtureMembership(13, 'unsubscribed', { meta: { reason: 'prior opt-out' } }),
			fixtureMembership(14, 'confirmed', { meta: { import: '2026-08' } }),
		],
	});
	Object.assign(byId.get(153) as FixtureSubscriber, {
		email: 'regex+literal@example.test',
		name: 'Regex [Literal] Supporter',
	});

	return subscribers;
}

let subscribers = initialSubscribers();
let nextSubscriberId = 159;
let subscriberMutationSequence = 0;
let optInRequestSequence = 0;
let optInRequests: FixtureOptInRequest[] = [];

type FixtureBounce = {
	id: number;
	type: 'hard' | 'soft' | 'complaint';
	source: string;
	meta: Record<string, unknown>;
	createdAt: string;
	email: string;
	subscriberUuid: string;
	subscriberId: number;
	subscriberStatus: 'enabled' | 'disabled' | 'blocklisted';
	campaign: { id: number; name: string } | null;
};

function initialBounces(): FixtureBounce[] {
	return Array.from({ length: 53 }, (_, index) => {
		const subscriberId = index < 2 ? 158 : 101 + (index % 52);
		// Cross the page boundary with an equal provider timestamp. Listmonk has
		// no secondary bounce ordering key; the app must not imply uniqueness.
		const hourOffset = index === 50 ? 49 : index;
		return {
			id: 201 + index,
			type: (['hard', 'soft', 'complaint'] as const)[index % 3] ?? 'hard',
			source: index % 2 === 0 ? 'smtp' : 'campaign',
			meta: { fixture: true, sequence: index + 1 },
			createdAt: new Date(Date.UTC(2026, 7, 26, 12) - hourOffset * 60 * 60 * 1_000).toISOString(),
			email: subscriberId === 158 ? 'ada.supporter@example.test' : `supporter-${subscriberId}@example.test`,
			subscriberUuid: `10000000-0000-4000-8000-${String(subscriberId).padStart(12, '0')}`,
			subscriberId,
			subscriberStatus: 'enabled',
			campaign: index % 4 === 0 ? null : { id: 21, name: 'August supporter update' },
		};
	});
}

let bounces = initialBounces();

type FixtureCampaign = {
	id: number;
	uuid: string;
	type: 'regular' | 'optin';
	name: string;
	subject: string;
	fromEmail: string;
	body: string;
	bodySource: string | null;
	altBody: string | null;
	sendAt: string | null;
	startedAt: string | null;
	status: 'draft' | 'scheduled' | 'running' | 'paused' | 'finished' | 'cancelled';
	contentType: 'richtext' | 'html' | 'markdown' | 'plain' | 'visual';
	tags: string[];
	templateId: number | null;
	messenger: string;
	headers: Array<Record<string, string>>;
	attribs: Record<string, unknown> | null;
	archive: boolean;
	archiveSlug: string | null;
	archiveTemplateId: number | null;
	archiveMeta: Record<string, unknown> | null;
	media: Array<{ id: number | null; filename: string }>;
	listIds: number[];
	views: number;
	clicks: number;
	bounces: number;
	toSend: number;
	sent: number;
	createdAt: string;
	updatedAt: string;
};

function initialCampaigns(): FixtureCampaign[] {
	return [{
		id: 21,
		uuid: '00000000-0000-4000-8000-000000000021',
		type: 'regular',
		name: 'August supporter update',
		subject: 'What happened in August',
		fromEmail: 'YAH <hello@example.test>',
		body: '<p>Fixture campaign body</p>',
		bodySource: null,
		altBody: 'Fixture campaign body',
		sendAt: null,
		startedAt: null,
		status: 'draft',
		contentType: 'richtext',
		tags: ['monthly', 'supporters'],
		templateId: 1,
		messenger: 'email',
		headers: [{ 'x-provider-owned': 'preserve-me' }],
		attribs: { providerOwned: true },
		archive: false,
		archiveSlug: null,
		archiveTemplateId: null,
		archiveMeta: { providerOwned: true },
		media: [],
		listIds: [11],
		views: 0,
		clicks: 0,
		bounces: 0,
		toSend: 39,
		sent: 0,
		createdAt: '2026-08-25T10:00:00Z',
		updatedAt: '2026-08-25T11:00:00Z',
	}];
}

let campaigns = initialCampaigns();
let nextCampaignId = 22;
let campaignMutationSequence = 0;
type FixtureCampaignAnalyticsRequest = {
	metric: 'views' | 'clicks';
	campaignIds: number[];
	from: string;
	to: string;
};
let campaignAnalyticsRequests: FixtureCampaignAnalyticsRequest[] = [];
type FixtureCampaignTestSendOutcome = 'accepted' | 'rejected' | 'ambiguous';
type FixtureCampaignTestSendRequest = {
	campaignId: number;
	payload: Record<string, unknown>;
};
let campaignTestSendOutcome: FixtureCampaignTestSendOutcome = 'accepted';
let campaignTestSendRequests: FixtureCampaignTestSendRequest[] = [];

type FixtureVisit = {
	referer: string;
	date: string;
	userAgent: string;
	potentialBot: boolean;
	visitLocation: { cityName: string; countryCode: string; countryName: string } | null;
};

type FixtureShortlink = {
	shortCode: string;
	longUrl: string;
	title: string | null;
	tags: string[];
	crawlable: boolean;
	forwardQuery: boolean;
	maxVisits: number | null;
	validUntil: string | null;
	dateCreated: string;
	visits: FixtureVisit[];
};

function initialShortlinks(): FixtureShortlink[] {
	return [
		{
			shortCode: 'press-kit',
			longUrl: 'https://example.test/press',
			title: 'Press kit',
			tags: ['press', 'media'],
			crawlable: false,
			forwardQuery: true,
			maxVisits: 500,
			validUntil: '2027-01-01T00:00:00.000Z',
			dateCreated: '2026-08-26T12:00:00.000Z',
			visits: [
				{
					referer: '',
					date: '2026-08-26T13:00:00.000Z',
					userAgent: 'Fixture Browser',
					potentialBot: false,
					visitLocation: { cityName: 'Austin', countryCode: 'US', countryName: 'United States' },
				},
				{
					referer: 'https://example.test/referrer',
					date: '2026-08-26T12:30:00.000Z',
					userAgent: 'Fixture Bot',
					potentialBot: true,
					visitLocation: null,
				},
			],
		},
		{
			shortCode: 'about',
			longUrl: 'https://example.test/about',
			title: 'About YAH',
			tags: ['site'],
			crawlable: true,
			forwardQuery: false,
			maxVisits: null,
			validUntil: null,
			dateCreated: '2026-08-25T12:00:00.000Z',
			visits: [],
		},
	];
}

let shortlinks = initialShortlinks();

function sendJson(response: ServerResponse, value: unknown, status = 200): void {
	response.writeHead(status, { 'content-type': 'application/json' });
	response.end(JSON.stringify(value));
}

function sendProblem(response: ServerResponse, value: unknown, status: number): void {
	response.writeHead(status, { 'content-type': 'application/problem+json' });
	response.end(JSON.stringify(value));
}

function sendHtml(response: ServerResponse, value: string): void {
	response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	response.end(value);
}

function sendPlain(response: ServerResponse, value: string): void {
	response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
	response.end(value);
}

function hasDateTimeOffset(value: string): boolean {
	return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function periodFactor(url: URL): number {
	const startAt = Number(url.searchParams.get('startAt'));
	const endAt = Number(url.searchParams.get('endAt'));
	const days = (endAt - startAt) / (24 * 60 * 60 * 1000);
	if (days <= 1.1) return 1;
	if (days <= 8) return 7;
	return 30;
}

function analyticsPayload(url: URL): unknown {
	const factor = periodFactor(url);
	if (url.pathname.endsWith('/stats')) {
		return { pageviews: factor * 100, visitors: factor * 40, visits: factor * 50, bounces: factor * 10, totaltime: factor * 6_250 };
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
		return (labels[type ?? ''] ?? []).map((x, index) => ({ x, y: factor * (9 - index) }));
	}
	if (url.pathname.endsWith('/active')) return { visitors: 14 };
	return null;
}

function visitSummary(link: FixtureShortlink) {
	const total = link.visits.length;
	const bots = link.visits.filter(({ potentialBot }) => potentialBot).length;
	return { total, nonBots: total - bots, bots };
}

function shlinkShortlink(link: FixtureShortlink) {
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
		meta: { validSince: null, validUntil: link.validUntil, maxVisits: link.maxVisits },
	};
}

function pagination(totalItems: number, itemsPerPage: number) {
	return {
		currentPage: 1,
		pagesCount: totalItems === 0 ? 0 : Math.ceil(totalItems / itemsPerPage),
		itemsPerPage,
		itemsInCurrentPage: Math.min(totalItems, itemsPerPage),
		totalItems,
	};
}

async function requestJson(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	if (!chunks.length) return {};
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

async function requestText(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks).toString('utf8');
}

function providerEmailTemplate(template: FixtureEmailTemplate, includeBody = true) {
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

function providerMailingList(list: FixtureMailingList) {
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

function providerSubscriberMembership(membership: FixtureSubscriberMembership) {
	const list = mailingLists.find(({ id }) => id === membership.listId);
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

function providerSubscriber(subscriber: FixtureSubscriber) {
	return {
		id: subscriber.id,
		uuid: subscriber.uuid,
		email: subscriber.email,
		name: subscriber.name,
		status: subscriber.status,
		attribs: subscriber.attribs,
		lists: subscriber.memberships
			.map(providerSubscriberMembership)
			.filter((membership) => membership !== null),
		created_at: subscriber.createdAt,
		updated_at: subscriber.updatedAt,
	};
}

function providerSubscriberActivity(activity: FixtureSubscriberActivity) {
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

function providerBounce(bounce: FixtureBounce) {
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

function providerCampaign(campaign: FixtureCampaign, includeBody = true) {
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
			const list = mailingLists.find((candidate) => candidate.id === id);
			return { id: list?.id ?? 0, name: list?.name ?? 'Deleted list' };
		}),
		created_at: campaign.createdAt,
		updated_at: campaign.updatedAt,
	};
}

function nextMailingListTimestamp(): string {
	mailingListMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 16, 0, mailingListMutationSequence)).toISOString();
}

function nextCampaignTimestamp(): string {
	campaignMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 17, 0, campaignMutationSequence)).toISOString();
}

function nextSubscriberTimestamp(): string {
	subscriberMutationSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 18, 0, subscriberMutationSequence)).toISOString();
}

function nextOptInTimestamp(): string {
	optInRequestSequence += 1;
	return new Date(Date.UTC(2026, 7, 26, 19, 0, optInRequestSequence)).toISOString();
}

function isMailingListType(value: unknown): value is FixtureMailingList['type'] {
	return value === 'public' || value === 'private' || value === 'temporary';
}

function isMailingListOptIn(value: unknown): value is FixtureMailingList['optin'] {
	return value === 'single' || value === 'double';
}

function isMailingListStatus(value: unknown): value is FixtureMailingList['status'] {
	return value === 'active' || value === 'archived';
}

function mailingListBodyIsValid(
	body: Record<string, unknown>,
): body is Record<string, unknown> & FixtureMailingListBody {
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

function renderEmailTemplate(body: string): string {
	return body
		.replace(/\{\{\s*template\s+"content"\s*\.\s*\}\}/g, '<article>Fixture campaign content</article>')
		.replace(/\{\{\s*\.Tx\.Data\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>');
}

function acceptListmonkRequest(request: IncomingMessage, response: ServerResponse): boolean {
	if (request.headers.authorization !== 'token admin:fixture-listmonk-secret') {
		sendJson(response, { message: 'Invalid fixture Listmonk token.' }, 401);
		return false;
	}
	if (failNextListmonkRequest) {
		failNextListmonkRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential listmonk diagnostic');
		return false;
	}
	return true;
}

async function handleListmonkTemplates(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/templates' && request.method === 'GET') {
		const withoutBody = url.searchParams.get('no_body') === 'true';
		sendJson(response, { data: emailTemplates.map((template) => providerEmailTemplate(template, !withoutBody)) });
		return;
	}
	if (url.pathname === '/api/templates' && request.method === 'POST') {
		const body = await requestJson(request);
		const kind = body['type'];
		if (kind !== 'tx' && kind !== 'campaign') {
			sendJson(response, { message: 'Unsupported fixture template type.' }, 422);
			return;
		}
		const now = new Date().toISOString();
		const created: FixtureEmailTemplate = {
			id: Math.max(0, ...emailTemplates.map(({ id }) => id)) + 1,
			name: String(body['name']),
			type: kind,
			subject: typeof body['subject'] === 'string' ? body['subject'] : '',
			body: String(body['body']),
			bodySource: null,
			isDefault: false,
			createdAt: now,
			updatedAt: now,
		};
		emailTemplates.push(created);
		sendJson(response, { data: providerEmailTemplate(created) });
		return;
	}
	if (url.pathname === '/api/templates/preview' && request.method === 'POST') {
		const form = new URLSearchParams(await requestText(request));
		sendHtml(response, renderEmailTemplate(form.get('body') ?? ''));
		return;
	}

	const previewMatch = url.pathname.match(/^\/api\/templates\/(\d+)\/preview$/);
	if (previewMatch && request.method === 'GET') {
		const template = emailTemplates.find(({ id }) => id === Number(previewMatch[1]));
		if (!template) {
			sendJson(response, { message: 'Unknown fixture template.' }, 400);
			return;
		}
		sendHtml(response, renderEmailTemplate(template.body));
		return;
	}

	const defaultMatch = url.pathname.match(/^\/api\/templates\/(\d+)\/default$/);
	if (defaultMatch && request.method === 'PUT') {
		const template = emailTemplates.find(({ id }) => id === Number(defaultMatch[1]));
		if (!template) {
			// Listmonk v6 does not check the affected row count: this narrow race
			// clears the prior default and still returns the whole template array.
			for (const candidate of emailTemplates) candidate.isDefault = false;
			sendJson(response, { data: emailTemplates.map((candidate) => providerEmailTemplate(candidate)) });
			return;
		}
		if (template.type !== 'campaign') {
			sendJson(response, { message: 'Only campaign templates can be default.' }, 422);
			return;
		}
		for (const candidate of emailTemplates) candidate.isDefault = candidate.id === template.id && candidate.type === 'campaign';
		template.updatedAt = new Date().toISOString();
		sendJson(response, { data: emailTemplates.map((candidate) => providerEmailTemplate(candidate)) });
		return;
	}

	const templateMatch = url.pathname.match(/^\/api\/templates\/(\d+)$/);
	if (templateMatch) {
		const id = Number(templateMatch[1]);
		const index = emailTemplates.findIndex((template) => template.id === id);
		if (index < 0) {
			sendJson(response, { message: 'Unknown fixture template.' }, 400);
			return;
		}
		const template = emailTemplates[index] as FixtureEmailTemplate;
		if (request.method === 'GET') {
			sendJson(response, { data: providerEmailTemplate(template) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			template.name = String(body['name']);
			template.subject = typeof body['subject'] === 'string' ? body['subject'] : '';
			template.body = String(body['body']);
			template.updatedAt = new Date().toISOString();
			sendJson(response, { data: providerEmailTemplate(template) });
			return;
		}
		if (request.method === 'DELETE') {
			if (template.isDefault) {
				sendJson(response, { message: 'Default template cannot be deleted.' }, 409);
				return;
			}
			emailTemplates.splice(index, 1);
			sendJson(response, { data: true });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk endpoint.' }, 404);
}

async function handleListmonkMailingLists(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/lists' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const offset = Math.max(0, (page - 1) * perPage);
		sendJson(response, {
			data: {
				results: mailingLists.slice(offset, offset + perPage).map(providerMailingList),
				query: '',
				total: mailingLists.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}
	if (url.pathname === '/api/lists' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!mailingListBodyIsValid(body)) {
			sendJson(response, { message: 'Invalid fixture mailing-list settings.' }, 422);
			return;
		}
		const now = nextMailingListTimestamp();
		const id = nextMailingListId;
		nextMailingListId += 1;
		const created: FixtureMailingList = {
			id,
			uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			name: body['name'],
			type: body['type'],
			optin: body['optin'],
			status: body['status'],
			description: body['description'],
			tags: body['tags'],
			subscriberCount: 0,
			subscriberStatuses: { confirmed: 0, unconfirmed: 0 },
			createdAt: now,
			updatedAt: now,
		};
		mailingLists.push(created);
		sendJson(response, { data: providerMailingList(created) });
		return;
	}

	const listMatch = url.pathname.match(/^\/api\/lists\/(\d+)$/);
	if (listMatch) {
		const id = Number(listMatch[1]);
		const index = mailingLists.findIndex((list) => list.id === id);
		if (index < 0) {
			// Listmonk v6 turns its missing-record database error into a 400 on
			// numeric detail routes rather than a conventional 404.
			sendJson(response, { message: 'Unknown fixture mailing list.' }, 400);
			return;
		}
		const list = mailingLists[index] as FixtureMailingList;
		if (request.method === 'GET') {
			sendJson(response, { data: providerMailingList(list) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!mailingListBodyIsValid(body)) {
				sendJson(response, { message: 'Invalid fixture mailing-list settings.' }, 422);
				return;
			}
			list.name = body['name'];
			list.type = body['type'];
			list.optin = body['optin'];
			list.status = body['status'];
			// Listmonk v6's update query preserves an existing description when
			// the submitted value is empty.
			if (body['description'] !== '') list.description = body['description'];
			list.tags = body['tags'];
			list.updatedAt = nextMailingListTimestamp();
			sendJson(response, { data: providerMailingList(list) });
			return;
		}
		if (request.method === 'DELETE') {
			mailingLists.splice(index, 1);
			for (const subscriber of subscribers) {
				subscriber.memberships = subscriber.memberships.filter((membership) => membership.listId !== id);
			}
			sendJson(response, { data: true });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk endpoint.' }, 404);
}

function isSubscriberStatus(value: unknown): value is FixtureSubscriber['status'] {
	return value === 'enabled' || value === 'disabled' || value === 'blocklisted';
}

function isSubscriptionStatus(value: unknown): value is FixtureSubscriptionStatus {
	return value === 'unconfirmed' || value === 'confirmed' || value === 'unsubscribed';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveUniqueIds(value: unknown): value is number[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((id) => Number.isSafeInteger(id) && Number(id) > 0) &&
		new Set(value).size === value.length
	);
}

function subscriberBodyIsValid(body: Record<string, unknown>): boolean {
	return (
		typeof body['email'] === 'string' &&
		typeof body['name'] === 'string' &&
		isSubscriberStatus(body['status']) &&
		Array.isArray(body['lists']) &&
		body['lists'].length <= 1_000 &&
		body['lists'].every((id) => Number.isSafeInteger(id) && Number(id) > 0) &&
		new Set(body['lists']).size === body['lists'].length &&
		isJsonObject(body['attribs']) &&
		typeof body['preconfirm_subscriptions'] === 'boolean'
	);
}

function requestedSubscriberLists(body: Record<string, unknown>): number[] {
	return body['lists'] as number[];
}

function allSubscriberListsExist(ids: readonly number[]): boolean {
	return ids.every((id) => mailingLists.some((list) => list.id === id));
}

function applyFullSubscriberUpdate(
	subscriber: FixtureSubscriber,
	body: Record<string, unknown>,
): void {
	const now = nextSubscriberTimestamp();
	const listIds = requestedSubscriberLists(body);
	const currentById = new Map(subscriber.memberships.map((membership) => [membership.listId, membership]));
	const preconfirmed = body['preconfirm_subscriptions'] === true;
	subscriber.email = body['email'] as string;
	// Listmonk v6 preserves the current name when an empty value is submitted.
	if (body['name'] !== '') subscriber.name = body['name'] as string;
	subscriber.status = body['status'] as FixtureSubscriber['status'];
	subscriber.attribs = body['attribs'] as Record<string, unknown>;
	subscriber.memberships = listIds.map((listId) => currentById.get(listId) ?? fixtureMembership(
		listId,
		preconfirmed ? 'confirmed' : 'unconfirmed',
		{ createdAt: now, updatedAt: now },
	));
	if (subscriber.status === 'blocklisted') {
		for (const membership of subscriber.memberships) {
			membership.status = 'unsubscribed';
			membership.updatedAt = now;
		}
	}
	subscriber.updatedAt = now;
}

async function handleListmonkBounces(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/bounces' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		if (
			!Number.isSafeInteger(page) || page < 1 ||
			!Number.isSafeInteger(perPage) || perPage !== 50 ||
			url.searchParams.get('order_by') !== 'created_at' ||
			url.searchParams.get('order') !== 'desc'
		) {
			sendJson(response, { message: 'Invalid fixture bounce catalog bounds.' }, 400);
			return;
		}
		const ordered = [...bounces].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
		const offset = (page - 1) * perPage;
		if (page > 1 && offset >= ordered.length) {
			// Listmonk derives these metadata fields from the first returned row,
			// so an empty out-of-range page is the special all-zero envelope.
			sendJson(response, { data: { results: [], query: '', search: '', total: 0, per_page: 0, page: 0 } });
			return;
		}
		sendJson(response, {
			data: {
				results: ordered.slice(offset, offset + perPage).map(providerBounce),
				query: '',
				search: '',
				total: ordered.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}

	if (url.pathname === '/api/bounces' && request.method === 'DELETE') {
		if (url.searchParams.get('all') === 'true') {
			bounces = [];
			sendJson(response, { data: true });
			return;
		}
		const ids = url.searchParams.getAll('id').map(Number);
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture bounce IDs.' }, 400);
			return;
		}
		bounces = bounces.filter((bounce) => !ids.includes(bounce.id));
		sendJson(response, { data: true });
		return;
	}

	sendJson(response, { message: 'Unknown fixture Listmonk bounce endpoint.' }, 404);
}

async function handleListmonkSubscribers(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/subscribers' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const search = url.searchParams.get('search') ?? '';
		const query = url.searchParams.get('query') ?? '';
		if (
			!Number.isSafeInteger(page) || page < 1 ||
			!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 50 ||
			search.length > 1_000 || query !== '' || url.searchParams.has('order_by') || url.searchParams.has('order')
		) {
			sendJson(response, { message: 'Invalid fixture subscriber catalog bounds.' }, 400);
			return;
		}
		let matcher: RegExp | null = null;
		try {
			matcher = search === '' ? null : new RegExp(search, 'i');
		} catch {
			sendJson(response, { message: 'Invalid fixture subscriber search expression.' }, 400);
			return;
		}
		const filtered = [...subscribers]
			.filter((subscriber) => matcher === null || matcher.test(subscriber.email) || matcher.test(subscriber.name))
			.sort((left, right) => right.id - left.id);
		const offset = (page - 1) * perPage;
		sendJson(response, {
			data: {
				results: filtered.slice(offset, offset + perPage).map(providerSubscriber),
				query,
				search,
				total: filtered.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}

	if (url.pathname === '/api/subscribers' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!subscriberBodyIsValid(body) || !allSubscriberListsExist(requestedSubscriberLists(body))) {
			sendJson(response, { message: 'Invalid fixture subscriber settings.' }, 422);
			return;
		}
		const email = body['email'] as string;
		if (subscribers.some((subscriber) => subscriber.email.toLowerCase() === email.toLowerCase())) {
			sendJson(response, { message: 'A fixture subscriber with this email already exists.' }, 409);
			return;
		}
		const now = nextSubscriberTimestamp();
		const id = nextSubscriberId++;
		const status = body['status'] as FixtureSubscriber['status'];
		const membershipStatus: FixtureSubscriptionStatus = status === 'blocklisted'
			? 'unsubscribed'
			: body['preconfirm_subscriptions'] === true ? 'confirmed' : 'unconfirmed';
		const created: FixtureSubscriber = {
			id,
			uuid: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			email,
			name: body['name'] as string,
			status,
			attribs: body['attribs'] as Record<string, unknown>,
			memberships: requestedSubscriberLists(body).map((listId) => fixtureMembership(
				listId,
				membershipStatus,
				{ createdAt: now, updatedAt: now },
			)),
			activity: emptySubscriberActivity(),
			createdAt: now,
			updatedAt: now,
		};
		subscribers.push(created);
		if (
			body['preconfirm_subscriptions'] !== true &&
			requestedSubscriberLists(body).some((listId) => mailingLists.find((list) => list.id === listId)?.optin === 'double')
		) {
			// Exact Listmonk v6 creation semantics: selected double-opt-in lists can
			// synchronously trigger a confirmation request. The v2 adapter must avoid
			// this path by posting the identity with no memberships.
			optInRequests.push({ subscriberId: created.id, requestedAt: nextOptInTimestamp() });
		}
		sendJson(response, { data: providerSubscriber(created) });
		return;
	}

	if (url.pathname === '/api/subscribers' && request.method === 'DELETE') {
		const ids = url.searchParams.getAll('id').map(Number);
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture subscriber IDs.' }, 400);
			return;
		}
		subscribers = subscribers.filter((subscriber) => !ids.includes(subscriber.id));
		bounces = bounces.filter((bounce) => !ids.includes(bounce.subscriberId));
		sendJson(response, { data: true });
		return;
	}

	if (url.pathname === '/api/subscribers/lists' && request.method === 'PUT') {
		const body = await requestJson(request);
		const ids = body['ids'];
		const targetListIds = body['target_list_ids'];
		const action = body['action'];
		const requestedStatus = body['status'];
		if (
			!positiveUniqueIds(ids) || ids.length > 100 ||
			!positiveUniqueIds(targetListIds) || targetListIds.length > 1_000 ||
			(action !== 'add' && action !== 'unsubscribe') ||
			(requestedStatus !== undefined && !isSubscriptionStatus(requestedStatus)) ||
			!allSubscriberListsExist(targetListIds)
		) {
			sendJson(response, { message: 'Invalid fixture subscriber membership update.' }, 422);
			return;
		}
		let mutationTimestamp: string | undefined;
		const timestamp = () => mutationTimestamp ??= nextSubscriberTimestamp();
		for (const subscriber of subscribers.filter(({ id }) => ids.includes(id))) {
			for (const listId of targetListIds) {
				const membership = subscriber.memberships.find((candidate) => candidate.listId === listId);
				if (action === 'unsubscribe') {
					if (membership) {
						membership.status = 'unsubscribed';
						membership.updatedAt = timestamp();
					}
					continue;
				}
				if (!membership) {
					subscriber.memberships.push(fixtureMembership(
						listId,
						requestedStatus ?? 'unconfirmed',
						{ createdAt: timestamp(), updatedAt: timestamp() },
					));
				} else if (requestedStatus !== undefined) {
					membership.status = requestedStatus;
					membership.updatedAt = timestamp();
				}
			}
		}
		// Listmonk mutates subscriber_lists.updated_at, not subscribers.updated_at.
		sendJson(response, { data: true });
		return;
	}

	if (url.pathname === '/api/subscribers/blocklist' && request.method === 'PUT') {
		const body = await requestJson(request);
		const ids = body['ids'];
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture subscriber IDs.' }, 422);
			return;
		}
		const now = nextSubscriberTimestamp();
		for (const subscriber of subscribers.filter(({ id }) => ids.includes(id))) {
			subscriber.status = 'blocklisted';
			subscriber.updatedAt = now;
			for (const membership of subscriber.memberships) {
				membership.status = 'unsubscribed';
				membership.updatedAt = now;
			}
		}
		sendJson(response, { data: true });
		return;
	}

	const bounceMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/bounces$/);
	if (bounceMatch) {
		const subscriberId = Number(bounceMatch[1]);
		if (!subscribers.some(({ id }) => id === subscriberId)) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		if (request.method === 'GET') {
			sendJson(response, { data: bounces.filter((bounce) => bounce.subscriberId === subscriberId).map(providerBounce) });
			return;
		}
		if (request.method === 'DELETE') {
			bounces = bounces.filter((bounce) => bounce.subscriberId !== subscriberId);
			sendJson(response, { data: true });
			return;
		}
	}

	const activityMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/activity$/);
	if (activityMatch && request.method === 'GET') {
		const subscriber = subscribers.find(({ id }) => id === Number(activityMatch[1]));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		sendJson(response, { data: providerSubscriberActivity(subscriber.activity) });
		return;
	}

	const optInMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/optin$/);
	if (optInMatch && request.method === 'POST') {
		const subscriber = subscribers.find(({ id }) => id === Number(optInMatch[1]));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		const eligible = subscriber.status === 'enabled' && subscriber.memberships.some((membership) => {
			const list = mailingLists.find(({ id }) => id === membership.listId);
			return membership.status === 'unconfirmed' && list?.optin === 'double';
		});
		if (!eligible) {
			sendJson(response, { message: 'Fixture subscriber has no pending double opt-in membership.' }, 409);
			return;
		}
		// The real provider queues mail here. The fixture records intent only and
		// never opens an SMTP or external network connection.
		optInRequests.push({ subscriberId: subscriber.id, requestedAt: nextOptInTimestamp() });
		sendJson(response, { data: true });
		return;
	}

	const subscriberMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)$/);
	if (subscriberMatch) {
		const subscriber = subscribers.find(({ id }) => id === Number(subscriberMatch[1]));
		if (!subscriber) {
			// Listmonk v6 returns 400 for a missing valid numeric subscriber ID.
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		if (request.method === 'GET') {
			sendJson(response, { data: providerSubscriber(subscriber) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!subscriberBodyIsValid(body) || !allSubscriberListsExist(requestedSubscriberLists(body))) {
				sendJson(response, { message: 'Invalid fixture subscriber settings.' }, 422);
				return;
			}
			const email = body['email'] as string;
			if (subscribers.some((candidate) => candidate.id !== subscriber.id && candidate.email.toLowerCase() === email.toLowerCase())) {
				sendJson(response, { message: 'A fixture subscriber with this email already exists.' }, 409);
				return;
			}
			applyFullSubscriberUpdate(subscriber, body);
			sendJson(response, { data: providerSubscriber(subscriber) });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk subscriber endpoint.' }, 404);
}

function isCampaignType(value: unknown): value is FixtureCampaign['type'] {
	return value === 'regular' || value === 'optin';
}

function isCampaignContentType(value: unknown): value is FixtureCampaign['contentType'] {
	return value === 'richtext' || value === 'html' || value === 'markdown' || value === 'plain' || value === 'visual';
}

function campaignCoreBodyIsValid(body: Record<string, unknown>): boolean {
	return (
		typeof body['name'] === 'string' && body['name'].trim().length > 0 &&
		typeof body['subject'] === 'string' && body['subject'].trim().length > 0 &&
		typeof body['from_email'] === 'string' &&
		Array.isArray(body['lists']) && body['lists'].length > 0 && body['lists'].every((id) => Number.isSafeInteger(id) && Number(id) > 0) &&
		typeof body['body'] === 'string' &&
		isCampaignContentType(body['content_type']) &&
		(body['template_id'] === null || (Number.isSafeInteger(body['template_id']) && Number(body['template_id']) > 0)) &&
		Array.isArray(body['tags']) && body['tags'].every((tag) => typeof tag === 'string') &&
		(body['send_at'] === null || (typeof body['send_at'] === 'string' && Date.parse(body['send_at']) > Date.now()))
	);
}

function campaignProviderFieldsAreValid(body: Record<string, unknown>): boolean {
	return (
		(body['altbody'] === null || typeof body['altbody'] === 'string') &&
		Array.isArray(body['headers']) && body['headers'].every((entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry)) &&
		(body['attribs'] === null || (typeof body['attribs'] === 'object' && body['attribs'] !== null && !Array.isArray(body['attribs']))) &&
		typeof body['messenger'] === 'string' &&
		typeof body['archive'] === 'boolean' &&
		(body['archive_slug'] === null || typeof body['archive_slug'] === 'string') &&
		(body['archive_template_id'] === null || (Number.isSafeInteger(body['archive_template_id']) && Number(body['archive_template_id']) > 0)) &&
		(body['archive_meta'] === null || (typeof body['archive_meta'] === 'object' && body['archive_meta'] !== null && !Array.isArray(body['archive_meta']))) &&
		(body['body_source'] === null || typeof body['body_source'] === 'string') &&
		Array.isArray(body['media']) && body['media'].every((id) => Number.isSafeInteger(id) && Number(id) > 0)
	);
}

function campaignTestPayload(campaign: FixtureCampaign, subscriber: FixtureSubscriber): Record<string, unknown> {
	return {
		name: campaign.name,
		subject: campaign.subject,
		lists: campaign.listIds,
		from_email: campaign.fromEmail,
		messenger: campaign.messenger,
		type: 'regular',
		headers: campaign.headers,
		tags: campaign.tags,
		template_id: campaign.templateId,
		content_type: campaign.contentType,
		body: campaign.body,
		altbody: campaign.contentType === 'plain' ? null : campaign.altBody,
		body_source: campaign.bodySource,
		media: campaign.media.flatMap(({ id }) => id === null ? [] : [id]),
		subscribers: [subscriber.email],
	};
}

function campaignTestBodyIsExact(
	body: Record<string, unknown>,
	campaign: FixtureCampaign,
	subscriber: FixtureSubscriber,
): boolean {
	return JSON.stringify(body) === JSON.stringify(campaignTestPayload(campaign, subscriber));
}

function renderCampaign(campaign: FixtureCampaign): string {
	if (campaign.contentType === 'plain') return campaign.body;
	const template = emailTemplates.find((candidate) => candidate.id === campaign.templateId) ?? emailTemplates.find((candidate) => candidate.isDefault);
	return template?.body.replace(/\{\{\s*template\s+"content"\s*\.\s*\}\}/g, campaign.body) ?? campaign.body;
}

async function handleListmonkCampaigns(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	const analyticsMatch = url.pathname.match(/^\/api\/campaigns\/analytics\/(views|clicks)$/);
	if (url.pathname === '/api/config' && request.method === 'GET') {
		sendJson(response, { data: { version: 'v6.2.0', messengers: ['email', 'email-primary'] } });
		return;
	}
	if (analyticsMatch && request.method === 'GET') {
		if (failNextCampaignAnalyticsRequest) {
			failNextCampaignAnalyticsRequest = false;
			response.writeHead(502, { 'content-type': 'text/plain' });
			response.end('fixture confidential campaign analytics diagnostic');
			return;
		}
		const metric = analyticsMatch[1] as FixtureCampaignAnalyticsRequest['metric'];
		const rawIds = url.searchParams.getAll('id');
		const campaignIds = rawIds.map(Number);
		const from = url.searchParams.get('from') ?? '';
		const to = url.searchParams.get('to') ?? '';
		const fromMatch = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/.exec(from);
		const toMatch = /^(\d{4}-\d{2}-\d{2})T23:59:59\.999999Z$/.exec(to);
		const validDate = (value: string) => {
			const milliseconds = Date.parse(`${value}T00:00:00Z`);
			return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
		};
		const fromDate = fromMatch?.[1] ?? '';
		const toDate = toMatch?.[1] ?? '';
		if (
			campaignIds.length === 0 ||
			campaignIds.length > 100 ||
			campaignIds.some((id) => !Number.isSafeInteger(id) || id < 1 || !campaigns.some((campaign) => campaign.id === id)) ||
			new Set(campaignIds).size !== campaignIds.length ||
			!validDate(fromDate) ||
			!validDate(toDate) ||
			fromDate > toDate
		) {
			sendJson(response, { message: 'Invalid fixture campaign analytics query.' }, 400);
			return;
		}
		campaignAnalyticsRequests.push({ metric, campaignIds, from, to });
		const sourceDates = ['2026-08-24T00:00:00Z', '2026-08-23T01:00:00Z', '2026-08-23T14:00:00Z'];
		const data = campaignIds.flatMap((campaignId, campaignIndex) => sourceDates
			.map((timestamp, dateIndex) => ({
				campaign_id: campaignId,
				count: (metric === 'views' ? [12, 5, 8] : [4, 1, 2])[dateIndex]! + campaignIndex,
				timestamp,
			}))
			.filter(({ timestamp }) => timestamp.slice(0, 10) >= fromDate && timestamp.slice(0, 10) <= toDate));
		sendJson(response, { data });
		return;
	}

	if (url.pathname === '/api/campaigns' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const offset = Math.max(0, (page - 1) * perPage);
		const includeBody = url.searchParams.get('no_body') !== 'true';
		sendJson(response, { data: { results: campaigns.slice(offset, offset + perPage).map((campaign) => providerCampaign(campaign, includeBody)), query: '', total: campaigns.length, per_page: perPage, page } });
		return;
	}
	if (url.pathname === '/api/campaigns' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!campaignCoreBodyIsValid(body) || !isCampaignType(body['type']) || body['messenger'] !== 'email') {
			sendJson(response, { message: 'Invalid fixture campaign settings.' }, 422);
			return;
		}
		const selectedIds = (body['lists'] as number[]).filter((id) => mailingLists.some((list) => list.id === id));
		if (selectedIds.length !== (body['lists'] as number[]).length) {
			sendJson(response, { message: 'Unknown fixture campaign list.' }, 422);
			return;
		}
		if (body['type'] === 'optin' && selectedIds.some((id) => mailingLists.find((list) => list.id === id)?.optin !== 'double')) {
			sendJson(response, { message: 'Confirmation campaigns require double opt-in lists.' }, 422);
			return;
		}
		const requestedTemplateId = body['template_id'] as number | null;
		const selectedTemplate = requestedTemplateId === null
			? emailTemplates.find((template) => template.type === 'campaign' && template.isDefault)
			: emailTemplates.find((template) => template.id === requestedTemplateId && template.type === 'campaign');
		if (!selectedTemplate) {
			sendJson(response, { message: 'Unknown or incompatible fixture campaign template.' }, 422);
			return;
		}
		const now = nextCampaignTimestamp();
		const id = nextCampaignId++;
		const created: FixtureCampaign = {
			id,
			uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			type: body['type'],
			name: String(body['name']),
			subject: String(body['subject']),
			fromEmail: String(body['from_email']) || 'Fixture <fixture@example.test>',
			body: body['type'] === 'optin' ? '<p>Please confirm your subscription.</p><p><a href="{{ OptinURL }}">Confirm subscription</a></p>' : String(body['body']),
			bodySource: null,
			altBody: null,
			sendAt: body['send_at'] as string | null,
			startedAt: null,
			status: 'draft',
			contentType: body['type'] === 'optin' ? 'richtext' : body['content_type'] as FixtureCampaign['contentType'],
			tags: body['tags'] as string[],
			templateId: selectedTemplate.id,
			messenger: 'email',
			headers: [],
			attribs: {},
			archive: false,
			archiveSlug: null,
			archiveTemplateId: null,
			archiveMeta: {},
			media: [],
			listIds: selectedIds,
			views: 0,
			clicks: 0,
			bounces: 0,
			toSend: selectedIds.reduce((total, listId) => total + (mailingLists.find((list) => list.id === listId)?.subscriberCount ?? 0), 0),
			sent: 0,
			createdAt: now,
			updatedAt: now,
		};
		campaigns.push(created);
		sendJson(response, { data: providerCampaign(created) });
		return;
	}
	if (url.pathname === '/api/campaigns' && request.method === 'DELETE') {
		const ids = url.searchParams.getAll('id').map(Number);
		if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
			sendJson(response, { message: 'Invalid fixture campaign IDs.' }, 400);
			return;
		}
		campaigns = campaigns.filter((campaign) => !ids.includes(campaign.id));
		sendJson(response, { data: true });
		return;
	}

	const previewMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/preview$/);
	if (previewMatch && request.method === 'GET') {
		const campaign = campaigns.find(({ id }) => id === Number(previewMatch[1]));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		if (campaign.contentType === 'plain') sendPlain(response, renderCampaign(campaign));
		else sendHtml(response, renderCampaign(campaign));
		return;
	}

	const statusMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/status$/);
	if (statusMatch && request.method === 'PUT') {
		const campaign = campaigns.find(({ id }) => id === Number(statusMatch[1]));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		const body = await requestJson(request);
		const target = body['status'];
		const allowed =
			(campaign.status === 'scheduled' && target === 'draft') ||
			((campaign.status === 'draft' || campaign.status === 'paused') && target === 'scheduled' && campaign.sendAt !== null) ||
			((campaign.status === 'draft' || campaign.status === 'paused') && target === 'running') ||
			(campaign.status === 'running' && (target === 'paused' || target === 'cancelled')) ||
			(campaign.status === 'paused' && target === 'cancelled');
		if (!allowed) {
			sendJson(response, { message: 'Invalid fixture campaign status transition.' }, 422);
			return;
		}
		const staleResponse = providerCampaign({ ...campaign, status: target as FixtureCampaign['status'] });
		campaign.status = target === 'running' && campaign.sendAt !== null ? 'scheduled' : target as FixtureCampaign['status'];
		campaign.updatedAt = nextCampaignTimestamp();
		if (campaign.status === 'running' && campaign.startedAt === null) campaign.startedAt = campaign.updatedAt;
		sendJson(response, { data: staleResponse });
		return;
	}

	const campaignTestMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/test$/);
	if (campaignTestMatch && request.method === 'POST') {
		const campaignId = Number(campaignTestMatch[1]);
		const campaign = campaigns.find(({ id }) => id === campaignId);
		const body = await requestJson(request);
		const recipients = body['subscribers'];
		const subscriber = Array.isArray(recipients) && recipients.length === 1 && typeof recipients[0] === 'string'
			? subscribers.find(({ email }) => email === recipients[0])
			: undefined;
		if (!campaign || !subscriber || !campaignTestBodyIsExact(body, campaign, subscriber)) {
			sendJson(response, { message: 'Invalid fixture campaign test-send payload.' }, 422);
			return;
		}
		const outcome = campaignTestSendOutcome;
		campaignTestSendOutcome = 'accepted';
		if (outcome === 'rejected') {
			sendJson(response, { message: 'Fixture campaign test-send rejected.' }, 422);
			return;
		}
		campaignTestSendRequests.push({ campaignId, payload: body });
		if (outcome === 'ambiguous') {
			response.writeHead(502, { 'content-type': 'text/plain' });
			response.end('fixture confidential campaign test-send diagnostic');
			return;
		}
		sendJson(response, { data: true });
		return;
	}

	const campaignMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)$/);
	if (campaignMatch) {
		const id = Number(campaignMatch[1]);
		const index = campaigns.findIndex((campaign) => campaign.id === id);
		if (index < 0) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		const campaign = campaigns[index] as FixtureCampaign;
		if (request.method === 'GET') {
			sendJson(response, { data: providerCampaign(campaign) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!campaignCoreBodyIsValid(body) || !campaignProviderFieldsAreValid(body) || !['draft', 'scheduled', 'paused'].includes(campaign.status)) {
				sendJson(response, { message: 'Invalid fixture campaign update.' }, 422);
				return;
			}
			const selectedIds = body['lists'] as number[];
			if (selectedIds.some((listId) => !mailingLists.some((list) => list.id === listId))) {
				sendJson(response, { message: 'Unknown fixture campaign list.' }, 422);
				return;
			}
			campaign.name = String(body['name']);
			campaign.subject = String(body['subject']);
			campaign.fromEmail = String(body['from_email']) || 'Fixture <fixture@example.test>';
			campaign.body = String(body['body']);
			campaign.altBody = body['altbody'] as string | null;
			campaign.contentType = body['content_type'] as FixtureCampaign['contentType'];
			campaign.sendAt = body['send_at'] as string | null;
			campaign.headers = body['headers'] as Array<Record<string, string>>;
			campaign.attribs = body['attribs'] as Record<string, unknown> | null;
			campaign.tags = body['tags'] as string[];
			campaign.messenger = String(body['messenger']);
			campaign.templateId = body['template_id'] as number | null;
			campaign.archive = body['archive'] as boolean;
			campaign.archiveSlug = body['archive_slug'] as string | null;
			campaign.archiveTemplateId = body['archive_template_id'] as number | null;
			campaign.archiveMeta = body['archive_meta'] as Record<string, unknown> | null;
			campaign.bodySource = campaign.contentType === 'visual' ? body['body_source'] as string | null : null;
			campaign.media = (body['media'] as number[]).map((mediaId) => campaign.media.find(({ id: currentId }) => currentId === mediaId) ?? { id: mediaId, filename: `media-${mediaId}` });
			campaign.listIds = selectedIds;
			if (campaign.status === 'scheduled' && campaign.sendAt === null) campaign.status = 'draft';
			campaign.updatedAt = nextCampaignTimestamp();
			sendJson(response, { data: providerCampaign(campaign) });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk campaign endpoint.' }, 404);
}

async function handleShlink(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (request.headers['x-api-key'] !== shlinkApiKey || !request.headers.accept?.includes('application/json')) {
		sendJson(response, { title: 'Unauthorized', detail: 'Invalid fixture API key.', status: 401, type: 'unauthorized' }, 401);
		return;
	}
	if (failNextShlinkRequest) {
		failNextShlinkRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential shlink diagnostic');
		return;
	}

	const restPath = url.pathname.slice('/rest/v3'.length);
	if (restPath === '/short-urls' && request.method === 'GET') {
		const itemsPerPage = Number(url.searchParams.get('itemsPerPage') ?? '10');
		const sorted = [...shortlinks].sort((left, right) => right.dateCreated.localeCompare(left.dateCreated));
		sendJson(response, {
			shortUrls: {
				data: sorted.slice(0, itemsPerPage).map(shlinkShortlink),
				pagination: pagination(sorted.length, itemsPerPage),
			},
		});
		return;
	}
	if (restPath === '/short-urls' && request.method === 'POST') {
		const body = await requestJson(request);
		const shortCode = typeof body['customSlug'] === 'string' ? body['customSlug'] : `generated-${shortlinks.length + 1}`;
		if (shortlinks.some((link) => link.shortCode === shortCode)) {
			sendProblem(response, {
				title: 'Invalid custom slug',
				detail: 'The short code already exists.',
				status: 400,
				type: 'https://shlink.io/api/error/non-unique-slug',
			}, 400);
			return;
		}
		if (typeof body['validUntil'] === 'string' && !hasDateTimeOffset(body['validUntil'])) {
			sendProblem(response, {
				title: 'Invalid data',
				detail: 'validUntil must include an offset.',
				status: 400,
				type: 'https://shlink.io/api/error/invalid-data',
			}, 400);
			return;
		}
		const created: FixtureShortlink = {
			shortCode,
			longUrl: String(body['longUrl']),
			title: typeof body['title'] === 'string' ? body['title'] : null,
			tags: Array.isArray(body['tags']) ? body['tags'].map(String) : [],
			crawlable: body['crawlable'] === true,
			forwardQuery: body['forwardQuery'] === true,
			maxVisits: typeof body['maxVisits'] === 'number' ? body['maxVisits'] : null,
			validUntil: typeof body['validUntil'] === 'string' ? new Date(body['validUntil']).toISOString() : null,
			dateCreated: new Date().toISOString(),
			visits: [],
		};
		shortlinks.unshift(created);
		sendJson(response, shlinkShortlink(created));
		return;
	}
	if (restPath === '/visits' && request.method === 'GET') {
		const summaries = shortlinks.map(visitSummary);
		const nonOrphanVisits = summaries.reduce(
			(total, item) => ({ total: total.total + item.total, nonBots: total.nonBots + item.nonBots, bots: total.bots + item.bots }),
			{ total: 0, nonBots: 0, bots: 0 },
		);
		sendJson(response, { visits: { nonOrphanVisits, orphanVisits: { total: 0, nonBots: 0, bots: 0 } } });
		return;
	}

	const visitsMatch = restPath.match(/^\/short-urls\/([^/]+)\/visits$/);
	if (visitsMatch) {
		const shortCode = decodeURIComponent(visitsMatch[1] ?? '');
		const link = shortlinks.find((candidate) => candidate.shortCode === shortCode);
		if (!link) {
			sendJson(response, { title: 'Not found', detail: 'Unknown short code.', status: 404, type: 'not-found' }, 404);
			return;
		}
		if (request.method === 'GET') {
			const excludeBots = url.searchParams.get('excludeBots') === 'true';
			const itemsPerPage = Number(url.searchParams.get('itemsPerPage') ?? '10');
			const visits = link.visits.filter((visit) => !excludeBots || !visit.potentialBot);
			sendJson(response, {
				visits: {
					data: visits.slice(0, itemsPerPage).map((visit) => ({ ...visit, visitedUrl: null, redirectUrl: null })),
					pagination: pagination(visits.length, itemsPerPage),
				},
			});
			return;
		}
		if (request.method === 'DELETE') {
			const deletedVisits = link.visits.length;
			link.visits = [];
			sendJson(response, { deletedVisits });
			return;
		}
	}

	const shortlinkMatch = restPath.match(/^\/short-urls\/([^/]+)$/);
	if (shortlinkMatch) {
		const shortCode = decodeURIComponent(shortlinkMatch[1] ?? '');
		const index = shortlinks.findIndex((candidate) => candidate.shortCode === shortCode);
		if (index < 0) {
			sendJson(response, { title: 'Not found', detail: 'Unknown short code.', status: 404, type: 'not-found' }, 404);
			return;
		}
		const link = shortlinks[index] as FixtureShortlink;
		if (request.method === 'GET') {
			sendJson(response, shlinkShortlink(link));
			return;
		}
		if (request.method === 'PATCH') {
			const body = await requestJson(request);
			if (typeof body['validUntil'] === 'string' && !hasDateTimeOffset(body['validUntil'])) {
				sendProblem(response, {
					title: 'Invalid data',
					detail: 'validUntil must include an offset.',
					status: 400,
					type: 'https://shlink.io/api/error/invalid-data',
				}, 400);
				return;
			}
			link.longUrl = String(body['longUrl']);
			link.title = typeof body['title'] === 'string' ? body['title'] : null;
			link.tags = Array.isArray(body['tags']) ? body['tags'].map(String) : [];
			link.crawlable = body['crawlable'] === true;
			link.forwardQuery = body['forwardQuery'] === true;
			link.maxVisits = typeof body['maxVisits'] === 'number' ? body['maxVisits'] : null;
			link.validUntil = typeof body['validUntil'] === 'string' ? new Date(body['validUntil']).toISOString() : null;
			sendJson(response, shlinkShortlink(link));
			return;
		}
		if (request.method === 'DELETE') {
			shortlinks.splice(index, 1);
			response.writeHead(204);
			response.end();
			return;
		}
	}

	sendJson(response, { title: 'Not found', detail: 'Unknown fixture endpoint.', status: 404, type: 'not-found' }, 404);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
	if (url.pathname === '/health') {
		sendJson(response, { status: 'ok' });
		return;
	}
	if (url.pathname === '/__control/fail-next' && request.method === 'POST') {
		const provider = url.searchParams.get('provider');
		if (provider === 'shlink') failNextShlinkRequest = true;
		else if (provider === 'listmonk') failNextListmonkRequest = true;
		else if (provider === 'campaign-analytics') failNextCampaignAnalyticsRequest = true;
		else failNextUmamiRequest = true;
		sendJson(response, { armed: true });
		return;
	}
	if (url.pathname === '/__control/transactional-messages' && request.method === 'GET') {
		sendJson(response, { messages: transactionalMessages });
		return;
	}
	if (url.pathname === '/__control/campaigns' && request.method === 'GET') {
		sendJson(response, { campaigns: campaigns.map((campaign) => providerCampaign(campaign)) });
		return;
	}
	if (url.pathname === '/__control/campaign-analytics' && request.method === 'GET') {
		sendJson(response, { requests: campaignAnalyticsRequests });
		return;
	}
	if (url.pathname === '/__control/campaign-test-sends' && request.method === 'GET') {
		sendJson(response, { requests: campaignTestSendRequests });
		return;
	}
	if (url.pathname === '/__control/campaign-test-send-outcome' && request.method === 'POST') {
		const outcome = url.searchParams.get('outcome');
		if (outcome !== 'accepted' && outcome !== 'rejected' && outcome !== 'ambiguous') {
			sendJson(response, { message: 'Unknown fixture campaign test-send outcome.' }, 400);
			return;
		}
		campaignTestSendOutcome = outcome;
		sendJson(response, { outcome });
		return;
	}
	if (url.pathname === '/__control/touch-campaign' && request.method === 'POST') {
		const campaign = campaigns.find(({ id }) => id === Number(url.searchParams.get('id')));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 404);
			return;
		}
		campaign.updatedAt = nextCampaignTimestamp();
		sendJson(response, { touched: campaign.id, updatedAt: campaign.updatedAt });
		return;
	}
	if (url.pathname === '/__control/campaign-messenger' && request.method === 'POST') {
		const campaign = campaigns.find(({ id }) => id === Number(url.searchParams.get('id')));
		const messenger = url.searchParams.get('messenger');
		if (!campaign || !messenger || !['email', 'email-primary', 'webhook'].includes(messenger)) {
			sendJson(response, { message: 'Unknown fixture campaign messenger target.' }, 400);
			return;
		}
		campaign.messenger = messenger;
		sendJson(response, { campaignId: campaign.id, messenger });
		return;
	}
	if (url.pathname === '/__control/subscribers' && request.method === 'GET') {
		sendJson(response, {
			subscribers: [...subscribers]
				.sort((left, right) => right.id - left.id)
				.map(providerSubscriber),
			optInRequests,
		});
		return;
	}
	if (url.pathname === '/__control/bounces' && request.method === 'GET') {
		sendJson(response, { bounces: [...bounces].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(providerBounce) });
		return;
	}
	if (url.pathname === '/__control/touch-subscriber' && request.method === 'POST') {
		const subscriber = subscribers.find(({ id }) => id === Number(url.searchParams.get('id')));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 404);
			return;
		}
		subscriber.updatedAt = nextSubscriberTimestamp();
		sendJson(response, { touched: subscriber.id, updatedAt: subscriber.updatedAt });
		return;
	}
	if (url.pathname === '/__control/touch-subscriber-membership' && request.method === 'POST') {
		const subscriber = subscribers.find(({ id }) => id === Number(url.searchParams.get('id')));
		const membership = subscriber?.memberships.find(({ listId }) => listId === Number(url.searchParams.get('listId')));
		if (!subscriber || !membership) {
			sendJson(response, { message: 'Unknown fixture subscriber membership.' }, 404);
			return;
		}
		membership.updatedAt = nextSubscriberTimestamp();
		sendJson(response, {
			touched: subscriber.id,
			listId: membership.listId,
			membershipUpdatedAt: membership.updatedAt,
		});
		return;
	}
	if (url.pathname === '/__control/reset' && request.method === 'POST') {
		shortlinks = initialShortlinks();
		emailTemplates = initialEmailTemplates();
		mailingLists = initialMailingLists();
		nextMailingListId = 15;
		mailingListMutationSequence = 0;
		campaigns = initialCampaigns();
		nextCampaignId = 22;
		campaignMutationSequence = 0;
		campaignAnalyticsRequests = [];
		campaignTestSendOutcome = 'accepted';
		campaignTestSendRequests = [];
		subscribers = initialSubscribers();
		bounces = initialBounces();
		nextSubscriberId = 159;
		subscriberMutationSequence = 0;
		optInRequestSequence = 0;
		optInRequests = [];
		failNextUmamiRequest = false;
		failNextShlinkRequest = false;
		failNextListmonkRequest = false;
		failNextCampaignAnalyticsRequest = false;
		transactionalMessages = [];
		sendJson(response, { reset: true });
		return;
	}
	if (url.pathname.startsWith('/rest/v3/')) {
		await handleShlink(request, response, url);
		return;
	}
	if (url.pathname.startsWith('/api/templates')) {
		await handleListmonkTemplates(request, response, url);
		return;
	}
	if (url.pathname === '/api/lists' || url.pathname.startsWith('/api/lists/')) {
		await handleListmonkMailingLists(request, response, url);
		return;
	}
	if (url.pathname === '/api/config' || url.pathname === '/api/campaigns' || url.pathname.startsWith('/api/campaigns/')) {
		await handleListmonkCampaigns(request, response, url);
		return;
	}
	if (url.pathname === '/api/bounces') {
		await handleListmonkBounces(request, response, url);
		return;
	}
	if (url.pathname === '/api/subscribers' || url.pathname.startsWith('/api/subscribers/')) {
		await handleListmonkSubscribers(request, response, url);
		return;
	}
	if (url.pathname === '/api/tx' && request.method === 'POST') {
		if (!acceptListmonkRequest(request, response)) return;
		transactionalMessages.push(await requestJson(request));
		sendJson(response, { data: true });
		return;
	}
	if (url.pathname === '/api/auth/login' && request.method === 'POST') {
		sendJson(response, { token: farFutureToken });
		return;
	}
	if (!url.pathname.startsWith('/api/websites/website%2Fid/')) {
		sendJson(response, { error: 'Not found.' }, 404);
		return;
	}
	if (request.headers.authorization !== `Bearer ${farFutureToken}`) {
		sendJson(response, { error: 'Unauthorized.' }, 401);
		return;
	}
	if (failNextUmamiRequest) {
		failNextUmamiRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential diagnostic');
		return;
	}

	setTimeout(() => sendJson(response, analyticsPayload(url)), 40);
}

const server = createServer((request, response) => {
	void handle(request, response).catch((error: unknown) => {
		console.error('[production-upstream] Fixture request failed', error);
		if (!response.headersSent) sendJson(response, { error: 'Fixture failure.' }, 500);
		else response.destroy();
	});
});
server.listen(port, '127.0.0.1');

function close(): void {
	server.close(() => process.exit(0));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
