import * as v from 'valibot';

export const SUBSCRIBER_PAGE_SIZE = 50;
export const MAX_SUBSCRIBER_PAGE = 10_000;
export const MAX_SUBSCRIBER_SEARCH_LENGTH = 200;
export const MAX_SUBSCRIBER_MEMBERSHIPS = 1_000;
export const MAX_BULK_SUBSCRIBER_SELECTION = 100;

const subscriberId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid subscriber.'));
const subscriberVersion = v.pipe(
	v.string(),
	v.maxLength(64),
	v.check((value) => !Number.isNaN(Date.parse(value)), 'The subscriber version is invalid.'),
);
const membershipVersion = v.pipe(
	v.string(),
	v.regex(/^smv1-[A-Za-z0-9_-]{43}$/, 'The subscriber membership version is invalid.'),
);
const email = v.pipe(
	v.string(),
	v.trim(),
	v.email('Enter a valid email address.'),
	v.maxLength(254, 'Email address is too long.'),
	v.transform((value) => value.toLowerCase()),
);
const name = v.pipe(v.string(), v.trim(), v.maxLength(2_000, 'Subscriber name is too long.'));
const listIds = v.pipe(
	v.array(v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid mailing list.'))),
	v.maxLength(MAX_SUBSCRIBER_MEMBERSHIPS, 'This subscriber belongs to too many mailing lists.'),
	v.check((values) => new Set(values).size === values.length, 'Select each mailing list only once.'),
);
const versionedSubscriber = v.strictObject({ id: subscriberId, expectedUpdatedAt: subscriberVersion });
const versionedSubscribers = v.pipe(
	v.array(versionedSubscriber),
	v.minLength(1, 'Select at least one subscriber.'),
	v.maxLength(
		MAX_BULK_SUBSCRIBER_SELECTION,
		`Select at most ${MAX_BULK_SUBSCRIBER_SELECTION} subscribers at once.`,
	),
	v.check(
		(values) => new Set(values.map((value) => value.id)).size === values.length,
		'Select each subscriber only once.',
	),
);

export const SubscriberIdSchema = subscriberId;
export const SubscriberStatusSchema = v.picklist(['enabled', 'disabled', 'blocklisted'] as const);
export const AuthorableSubscriberStatusSchema = v.picklist(['enabled', 'disabled'] as const);
export const SubscriptionStatusSchema = v.picklist(['unconfirmed', 'confirmed', 'unsubscribed'] as const);
export const SubscriberCapabilitySchema = v.picklist(['view', 'create', 'edit', 'delete', 'blocklist'] as const);
export const ListSubscribersQuerySchema = v.strictObject({
	page: v.pipe(
		v.number(),
		v.safeInteger(),
		v.minValue(1, 'Select a valid subscriber page.'),
		v.maxValue(MAX_SUBSCRIBER_PAGE, 'Select a valid subscriber page.'),
	),
	search: v.pipe(
		v.string(),
		v.trim(),
		v.maxLength(MAX_SUBSCRIBER_SEARCH_LENGTH, 'Subscriber search is too long.'),
	),
});
export const CreateSubscriberCommandSchema = v.strictObject({
	email,
	name,
	status: AuthorableSubscriberStatusSchema,
	listIds,
	preconfirmSubscriptions: v.boolean(),
});
export const UpdateSubscriberProfileCommandSchema = v.strictObject({
	id: subscriberId,
	expectedUpdatedAt: subscriberVersion,
	email,
	name,
	status: SubscriberStatusSchema,
});
export const UpdateSubscriberMembershipsCommandSchema = v.strictObject({
	id: subscriberId,
	expectedUpdatedAt: subscriberVersion,
	expectedMembershipVersion: membershipVersion,
	listIds,
});
export const DeleteSubscribersCommandSchema = v.strictObject({ subscribers: versionedSubscribers });
export const BlocklistSubscribersCommandSchema = v.strictObject({ subscribers: versionedSubscribers });
export const RequestSubscriberOptInCommandSchema = v.strictObject({
	id: subscriberId,
	expectedUpdatedAt: subscriberVersion,
	expectedMembershipVersion: membershipVersion,
});

export type SubscriberStatus = v.InferOutput<typeof SubscriberStatusSchema>;
export type AuthorableSubscriberStatus = v.InferOutput<typeof AuthorableSubscriberStatusSchema>;
export type SubscriptionStatus = v.InferOutput<typeof SubscriptionStatusSchema>;
export type SubscriberCapability = v.InferOutput<typeof SubscriberCapabilitySchema>;
export type ListSubscribersQuery = v.InferInput<typeof ListSubscribersQuerySchema>;
export type CreateSubscriberCommand = v.InferInput<typeof CreateSubscriberCommandSchema>;
export type UpdateSubscriberProfileCommand = v.InferInput<typeof UpdateSubscriberProfileCommandSchema>;
export type UpdateSubscriberMembershipsCommand = v.InferInput<typeof UpdateSubscriberMembershipsCommandSchema>;
export type DeleteSubscribersCommand = v.InferInput<typeof DeleteSubscribersCommandSchema>;
export type BlocklistSubscribersCommand = v.InferInput<typeof BlocklistSubscribersCommandSchema>;
export type RequestSubscriberOptInCommand = v.InferInput<typeof RequestSubscriberOptInCommandSchema>;

export type SubscriberVersion = { id: number; expectedUpdatedAt: string };

export type SubscriberSummary = {
	id: number;
	uuid: string;
	email: string;
	name: string;
	status: SubscriberStatus;
	createdAt: string;
	updatedAt: string;
};

export type SubscriberMembership = {
	id: number;
	uuid: string;
	name: string;
	kind: 'public' | 'private' | 'temporary';
	optIn: 'single' | 'double';
	listStatus: 'active' | 'archived';
	description: string | null;
	restricted: boolean;
	status: SubscriptionStatus;
	createdAt: string;
	updatedAt: string;
	meta: Record<string, unknown>;
};

export type SubscriberProfile = SubscriberSummary & {
	attributes: Record<string, unknown>;
};

export type SubscriberMembershipState = {
	memberships: SubscriberMembership[];
	membershipVersion: string;
	canRequestOptIn: boolean;
};

/** Provider-internal aggregate. Public reads return the least-privilege projections above. */
export type SubscriberDetail = SubscriberProfile & SubscriberMembershipState;

export type SubscriberPage = {
	items: SubscriberSummary[];
	total: number;
	page: number;
	pageSize: typeof SUBSCRIBER_PAGE_SIZE;
	search: string;
};

export type SubscriberActivity = {
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

/** A diagnostic-free provider failure safe for feature services to classify. */
export class SubscriberProviderFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk subscriber request failed with status ${status}.`);
		this.name = 'SubscriberProviderFailure';
	}
}

/** A multi-call membership diff changed provider state before it could finish or verify. */
export class SubscriberPartialMutationFailure extends Error {
	constructor() {
		super('Listmonk may have partially applied the subscriber membership change.');
		this.name = 'SubscriberPartialMutationFailure';
	}
}

/** An opt-in POST may have queued mail even though its acknowledgement was lost. */
export class SubscriberAmbiguousOptInFailure extends Error {
	constructor() {
		super('Listmonk may have accepted the subscriber opt-in request.');
		this.name = 'SubscriberAmbiguousOptInFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isSubscriberProviderFailure(error: unknown): error is SubscriberProviderFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'SubscriberProviderFailure' &&
		'status' in error &&
		typeof error.status === 'number'
	);
}

export function isSubscriberPartialMutationFailure(error: unknown): error is SubscriberPartialMutationFailure {
	return typeof error === 'object' && error !== null && 'name' in error && error.name === 'SubscriberPartialMutationFailure';
}

export function isSubscriberAmbiguousOptInFailure(error: unknown): error is SubscriberAmbiguousOptInFailure {
	return typeof error === 'object' && error !== null && 'name' in error && error.name === 'SubscriberAmbiguousOptInFailure';
}
