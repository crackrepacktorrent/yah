import { createListmonkV62SettingsFixture } from '../../src/integrations/listmonk/listmonk-settings-document.fixture';

export const farFutureToken = `header.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url')}.fixture`;
export const shlinkApiKey = 'fixture-shlink-secret';
let failNextUmamiRequest = false;
let delayNextUmamiRequest = false;
let failNextShlinkRequest = false;
let failNextListmonkRequest = false;
let failNextCampaignAnalyticsRequest = false;
let transactionalMessages: Record<string, unknown>[] = [];
let smtpTestRequests: Array<{
	authProtocol: unknown;
	email: unknown;
	hadPassword: boolean;
	host: unknown;
}> = [];

function initialListmonkSettings(): Record<string, unknown> {
	return {
		...createListmonkV62SettingsFixture(),
		'app.lang': 'en',
		'app.from_email': 'YAH <hello@example.test>',
		'app.notify_emails': ['operator@example.test'],
		'app.send_optin_confirmation': true,
		'app.enable_public_subscription_page': true,
		'app.root_url': 'https://mail.example.test',
		'bounce.enabled': true,
		'privacy.disable_tracking': false,
		'privacy.individual_tracking': true,
		'privacy.unsubscribe_header': true,
		'privacy.record_optin_ip': false,
		'privacy.allow_blocklist': true,
		'privacy.allow_preferences': true,
		'privacy.allow_export': true,
		'privacy.allow_wipe': true,
		'privacy.domain_blocklist': ['blocked.example'],
		'privacy.domain_allowlist': [],
		'privacy.exportable': ['profile', 'subscriptions', 'campaign_views', 'link_clicks'],
		'appearance.admin.custom_css': 'body::after { content: "••"; }',
		smtp: [
			{
				uuid: '10000000-0000-4000-8000-000000000001',
				name: 'email-primary',
				enabled: true,
				host: 'smtp.example.test',
				port: 587,
				auth_protocol: 'login',
				username: 'mailer',
				password: '••••••••',
				email_headers: [{ 'X-Provider': 'keep-me' }],
				hello_hostname: '',
				max_conns: 10,
				max_msg_retries: 2,
				msg_retry_delay: '10ms',
				idle_timeout: '15s',
				wait_timeout: '5s',
				tls_type: 'STARTTLS',
				tls_skip_verify: false,
				from_addresses: ['example.test'],
			},
		],
	};
}

function initialListmonkLogs(): string[] {
	return [
		'2026-08-27T10:00:00Z listmonk started',
		'2026-08-27T10:00:01Z SMTP pool ready',
		'2026-08-27T10:00:02Z campaign worker ready',
		'2026-08-27T10:00:03Z bounce worker ready',
		'2026-08-27T10:00:04Z housekeeping complete',
		...Array.from({ length: 199 }, (_, index) => `2026-08-27T10:${String(index + 5).padStart(2, '0')}:00Z worker event ${index + 1}`),
		'2026-08-27T14:00:00Z authorization: Bearer fixture-log-token password=fixture-log-secret delivery diagnostic',
	];
}

let listmonkSettings = initialListmonkSettings();
let listmonkLogs = initialListmonkLogs();

export type FixtureEmailTemplate = {
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

export type FixtureMailingList = {
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

export type FixtureMailingListBody = Pick<FixtureMailingList, 'name' | 'type' | 'optin' | 'status' | 'description' | 'tags'>;

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

export type FixtureSubscriptionStatus = 'unconfirmed' | 'confirmed' | 'unsubscribed';

export type FixtureSubscriberMembership = {
	listId: number;
	status: FixtureSubscriptionStatus;
	restricted: boolean;
	meta: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type FixtureSubscriberActivity = {
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

export type FixtureSubscriber = {
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

export type FixtureOptInRequest = {
	subscriberId: number;
	requestedAt: string;
};

export const emptySubscriberActivity = (): FixtureSubscriberActivity => ({
	campaignViews: [],
	linkClicks: [],
});

export function fixtureMembership(
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
			fixtureMembership(11, 'confirmed', {
				meta: { source: 'signup-form', verified: true },
			}),
			fixtureMembership(12, 'confirmed', { meta: { coordinator: 'Sam' } }),
		],
		activity: {
			campaignViews: [
				{
					campaignId: 21,
					campaignUuid: '00000000-0000-4000-8000-000000000021',
					campaignName: 'August supporter update',
					campaignSubject: 'What happened in August',
					viewCount: 3,
					lastViewedAt: '2026-08-26T15:30:00Z',
				},
			],
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
		memberships: [fixtureMembership(11, 'unsubscribed', { meta: { reason: 'complaint' } }), fixtureMembership(13, 'unsubscribed', { meta: { reason: 'complaint' } })],
	});
	Object.assign(byId.get(155) as FixtureSubscriber, {
		email: 'pending.member@example.test',
		name: 'Pending Double Opt-in',
		attribs: { source: 'press-signup' },
		memberships: [
			fixtureMembership(11, 'unconfirmed', {
				meta: { source: 'press-signup' },
			}),
			fixtureMembership(12, 'confirmed'),
		],
	});
	Object.assign(byId.get(154) as FixtureSubscriber, {
		email: 'protected.member@example.test',
		name: 'Protected Memberships',
		attribs: { source: 'migration', providerOwned: { retain: true } },
		memberships: [
			fixtureMembership(12, 'confirmed', {
				restricted: true,
				meta: { providerOwned: true },
			}),
			fixtureMembership(13, 'unsubscribed', {
				meta: { reason: 'prior opt-out' },
			}),
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

export type FixtureBounce = {
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

export type FixtureCampaign = {
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
	return [
		{
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
		},
	];
}

let campaigns = initialCampaigns();
let nextCampaignId = 22;
let campaignMutationSequence = 0;
export type FixtureCampaignAnalyticsRequest = {
	metric: 'views' | 'clicks';
	campaignIds: number[];
	from: string;
	to: string;
};
let campaignAnalyticsRequests: FixtureCampaignAnalyticsRequest[] = [];
export type FixtureCampaignTestSendOutcome = 'accepted' | 'rejected' | 'ambiguous';
export type FixtureCampaignTestSendRequest = {
	campaignId: number;
	payload: Record<string, unknown>;
};
let campaignTestSendOutcome: FixtureCampaignTestSendOutcome = 'accepted';
let campaignTestSendRequests: FixtureCampaignTestSendRequest[] = [];

export type FixtureVisit = {
	referer: string;
	date: string;
	userAgent: string;
	potentialBot: boolean;
	visitLocation: {
		cityName: string;
		countryCode: string;
		countryName: string;
	} | null;
};

export type FixtureShortlink = {
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
					visitLocation: {
						cityName: 'Austin',
						countryCode: 'US',
						countryName: 'United States',
					},
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

export const fixtureState = {
	get failNextUmamiRequest() {
		return failNextUmamiRequest;
	},
	set failNextUmamiRequest(value) {
		failNextUmamiRequest = value;
	},
	get delayNextUmamiRequest() {
		return delayNextUmamiRequest;
	},
	set delayNextUmamiRequest(value) {
		delayNextUmamiRequest = value;
	},
	get failNextShlinkRequest() {
		return failNextShlinkRequest;
	},
	set failNextShlinkRequest(value) {
		failNextShlinkRequest = value;
	},
	get failNextListmonkRequest() {
		return failNextListmonkRequest;
	},
	set failNextListmonkRequest(value) {
		failNextListmonkRequest = value;
	},
	get failNextCampaignAnalyticsRequest() {
		return failNextCampaignAnalyticsRequest;
	},
	set failNextCampaignAnalyticsRequest(value) {
		failNextCampaignAnalyticsRequest = value;
	},
	get transactionalMessages() {
		return transactionalMessages;
	},
	set transactionalMessages(value) {
		transactionalMessages = value;
	},
	get smtpTestRequests() {
		return smtpTestRequests;
	},
	set smtpTestRequests(value) {
		smtpTestRequests = value;
	},
	get listmonkSettings() {
		return listmonkSettings;
	},
	set listmonkSettings(value) {
		listmonkSettings = value;
	},
	get listmonkLogs() {
		return listmonkLogs;
	},
	set listmonkLogs(value) {
		listmonkLogs = value;
	},
	get emailTemplates() {
		return emailTemplates;
	},
	set emailTemplates(value) {
		emailTemplates = value;
	},
	get mailingLists() {
		return mailingLists;
	},
	set mailingLists(value) {
		mailingLists = value;
	},
	get nextMailingListId() {
		return nextMailingListId;
	},
	set nextMailingListId(value) {
		nextMailingListId = value;
	},
	get mailingListMutationSequence() {
		return mailingListMutationSequence;
	},
	set mailingListMutationSequence(value) {
		mailingListMutationSequence = value;
	},
	get subscribers() {
		return subscribers;
	},
	set subscribers(value) {
		subscribers = value;
	},
	get nextSubscriberId() {
		return nextSubscriberId;
	},
	set nextSubscriberId(value) {
		nextSubscriberId = value;
	},
	get subscriberMutationSequence() {
		return subscriberMutationSequence;
	},
	set subscriberMutationSequence(value) {
		subscriberMutationSequence = value;
	},
	get optInRequestSequence() {
		return optInRequestSequence;
	},
	set optInRequestSequence(value) {
		optInRequestSequence = value;
	},
	get optInRequests() {
		return optInRequests;
	},
	set optInRequests(value) {
		optInRequests = value;
	},
	get bounces() {
		return bounces;
	},
	set bounces(value) {
		bounces = value;
	},
	get campaigns() {
		return campaigns;
	},
	set campaigns(value) {
		campaigns = value;
	},
	get nextCampaignId() {
		return nextCampaignId;
	},
	set nextCampaignId(value) {
		nextCampaignId = value;
	},
	get campaignMutationSequence() {
		return campaignMutationSequence;
	},
	set campaignMutationSequence(value) {
		campaignMutationSequence = value;
	},
	get campaignAnalyticsRequests() {
		return campaignAnalyticsRequests;
	},
	set campaignAnalyticsRequests(value) {
		campaignAnalyticsRequests = value;
	},
	get campaignTestSendOutcome() {
		return campaignTestSendOutcome;
	},
	set campaignTestSendOutcome(value) {
		campaignTestSendOutcome = value;
	},
	get campaignTestSendRequests() {
		return campaignTestSendRequests;
	},
	set campaignTestSendRequests(value) {
		campaignTestSendRequests = value;
	},
	get shortlinks() {
		return shortlinks;
	},
	set shortlinks(value) {
		shortlinks = value;
	},
	reset(): void {
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
		delayNextUmamiRequest = false;
		failNextShlinkRequest = false;
		failNextListmonkRequest = false;
		failNextCampaignAnalyticsRequest = false;
		transactionalMessages = [];
		smtpTestRequests = [];
		listmonkSettings = initialListmonkSettings();
		listmonkLogs = initialListmonkLogs();
	},
};
