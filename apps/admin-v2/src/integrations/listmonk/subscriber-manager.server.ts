import 'server-only';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import {
	MAX_BULK_SUBSCRIBER_SELECTION,
	MAX_SUBSCRIBER_MEMBERSHIPS,
	SUBSCRIBER_PAGE_SIZE,
	SubscriberAmbiguousOptInFailure,
	SubscriberPartialMutationFailure,
	SubscriberProviderFailure,
	type SubscriberActivity,
	type SubscriberDetail,
	type SubscriberMembership,
	type SubscriberPage,
	type SubscriberStatus,
	type SubscriberSummary,
	type SubscriberVersion,
} from '~/features/subscribers/contracts';
import type { SubscriberManager } from '~/features/subscribers/service';
import { createProviderResponseParser } from '~/integrations/provider-response.server';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, ListmonkHttpFailure, type ListmonkRequest } from './transport.server';

const MAX_ACTIVITY_GROUPS = 1_000;
const PROVIDER_READ_CONCURRENCY = 10;
const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const nonNegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const dateText = v.pipe(v.string(), v.maxLength(64), v.check((value) => !Number.isNaN(Date.parse(value))));
const boundedText = (maximum: number) => v.pipe(v.string(), v.maxLength(maximum));
const jsonObjectSchema = v.record(v.string(), v.unknown());
const subscriberStatusSchema = v.picklist(['enabled', 'disabled', 'blocklisted'] as const);
const subscriptionStatusSchema = v.picklist(['unconfirmed', 'confirmed', 'unsubscribed'] as const);
const subscriptionSchema = v.object({
	id: positiveInteger,
	created_at: dateText,
	updated_at: dateText,
	uuid: v.pipe(v.string(), v.uuid()),
	name: boundedText(2_000),
	type: v.picklist(['public', 'private', 'temporary'] as const),
	optin: v.picklist(['single', 'double'] as const),
	status: v.picklist(['active', 'archived'] as const),
	description: v.optional(v.string()),
	restricted: v.optional(v.boolean()),
	subscription_status: subscriptionStatusSchema,
	subscription_created_at: dateText,
	subscription_updated_at: dateText,
	subscription_meta: jsonObjectSchema,
});
const subscriberSchema = v.object({
	id: positiveInteger,
	created_at: dateText,
	updated_at: dateText,
	uuid: v.pipe(v.string(), v.uuid()),
	email: boundedText(1_000),
	name: boundedText(2_000),
	status: subscriberStatusSchema,
	attribs: jsonObjectSchema,
	lists: v.pipe(v.array(subscriptionSchema), v.maxLength(MAX_SUBSCRIBER_MEMBERSHIPS)),
});
const subscriberResponseSchema = v.object({ data: subscriberSchema });
const subscriberCatalogResponseSchema = v.object({
	data: v.object({
		results: v.pipe(v.array(subscriberSchema), v.maxLength(SUBSCRIBER_PAGE_SIZE)),
		query: boundedText(10_000),
		search: boundedText(1_000),
		total: nonNegativeInteger,
		per_page: positiveInteger,
		page: positiveInteger,
	}),
});
const campaignViewSchema = v.object({
	id: positiveInteger,
	uuid: v.pipe(v.string(), v.uuid()),
	name: boundedText(2_000),
	subject: boundedText(5_000),
	view_count: nonNegativeInteger,
	last_viewed_at: dateText,
});
const linkClickSchema = v.object({
	link_id: positiveInteger,
	url: boundedText(10_000),
	campaign_id: v.nullable(positiveInteger),
	campaign_uuid: v.nullable(v.pipe(v.string(), v.uuid())),
	campaign_name: v.nullable(boundedText(2_000)),
	campaign_subject: v.nullable(boundedText(5_000)),
	click_count: nonNegativeInteger,
	last_clicked_at: dateText,
});
const subscriberActivityResponseSchema = v.object({
	data: v.object({
		campaign_views: v.pipe(v.array(campaignViewSchema), v.maxLength(MAX_ACTIVITY_GROUPS)),
		link_clicks: v.pipe(v.array(linkClickSchema), v.maxLength(MAX_ACTIVITY_GROUPS)),
	}),
});
const trueResponseSchema = v.object({ data: v.literal(true) });
const mailingListTargetResponseSchema = v.object({
	data: v.object({
		id: positiveInteger,
		type: v.picklist(['public', 'private', 'temporary'] as const),
		optin: v.picklist(['single', 'double'] as const),
		status: v.picklist(['active', 'archived'] as const),
	}),
});

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
type SubscriberDto = v.InferOutput<typeof subscriberSchema>;
type SubscriptionDto = v.InferOutput<typeof subscriptionSchema>;
const parse = createProviderResponseParser('Listmonk');

function normalizeMembership(value: SubscriptionDto): SubscriberMembership {
	return {
		id: value.id,
		uuid: value.uuid,
		name: value.name,
		kind: value.type,
		optIn: value.optin,
		listStatus: value.status,
		description: value.description ?? null,
		restricted: value.restricted ?? false,
		status: value.subscription_status,
		createdAt: value.subscription_created_at,
		updatedAt: value.subscription_updated_at,
		meta: value.subscription_meta,
	};
}

function normalizeSummary(value: SubscriberDto): SubscriberSummary {
	return {
		id: value.id,
		uuid: value.uuid,
		email: value.email,
		name: value.name,
		status: value.status as SubscriberStatus,
		createdAt: value.created_at,
		updatedAt: value.updated_at,
	};
}

function normalizeDetail(value: SubscriberDto): SubscriberDetail {
	const memberships = value.lists.map(normalizeMembership);
	return {
		...normalizeSummary(value),
		attributes: value.attribs,
		memberships,
		membershipVersion: membershipVersion(value),
		canRequestOptIn:
			value.status === 'enabled' &&
			memberships.some((membership) => membership.status === 'unconfirmed' && membership.optIn === 'double'),
	};
}

function membershipVersion(value: SubscriberDto): string {
	const versioned = [...value.lists]
		.sort((left, right) => left.id - right.id)
		.map((membership) => ({
			id: membership.id,
			status: membership.subscription_status,
			updatedAt: membership.subscription_updated_at,
			kind: membership.type,
			optIn: membership.optin,
			listStatus: membership.status,
			restricted: membership.restricted ?? false,
		}));
	const digest = createHash('sha256')
		.update(canonicalJson({ updatedAt: value.updated_at, memberships: versioned }))
		.digest('base64url');
	return `smv1-${digest}`;
}

function normalizeActivity(
	value: v.InferOutput<typeof subscriberActivityResponseSchema>['data'],
): SubscriberActivity {
	return {
		campaignViews: value.campaign_views.map((view) => ({
			campaignId: view.id,
			campaignUuid: view.uuid,
			campaignName: view.name,
			campaignSubject: view.subject,
			viewCount: view.view_count,
			lastViewedAt: view.last_viewed_at,
		})),
		linkClicks: value.link_clicks.map((click) => ({
			linkId: click.link_id,
			url: click.url,
			campaignId: click.campaign_id,
			campaignUuid: click.campaign_uuid,
			campaignName: click.campaign_name,
			campaignSubject: click.campaign_subject,
			clickCount: click.click_count,
			lastClickedAt: click.last_clicked_at,
		})),
	};
}

async function providerCall<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ListmonkHttpFailure) throw new SubscriberProviderFailure(error.status);
		throw error;
	}
}

/** Listmonk v6 treats search as a PostgreSQL regex; the app owns literal-search semantics. */
function escapeProviderSearch(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameIds(actual: readonly number[], expected: readonly number[]): boolean {
	if (actual.length !== expected.length) return false;
	const actualSet = new Set(actual);
	return actualSet.size === actual.length && expected.every((id) => actualSet.has(id));
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (typeof value === 'object' && value !== null) {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}

function requireExactMemberships(value: SubscriberDto, expected: readonly number[], operation: string): void {
	if (!sameIds(value.lists.map(({ id }) => id), expected)) {
		throw new Error(`Listmonk did not preserve the complete ${operation} membership set.`);
	}
}

function requireMembershipStates(
	value: SubscriberDto,
	expected: ReadonlyMap<number, { status: 'unconfirmed' | 'confirmed' | 'unsubscribed'; meta?: Record<string, unknown> }>,
	operation: string,
): void {
	for (const membership of value.lists) {
		const state = expected.get(membership.id);
		if (
			!state ||
			membership.subscription_status !== state.status ||
			(state.meta !== undefined && canonicalJson(membership.subscription_meta) !== canonicalJson(state.meta))
		) {
			throw new Error(`Listmonk did not preserve the complete ${operation} membership state.`);
		}
	}
}

function requireBoundedUniqueIds(ids: readonly number[]): void {
	if (
		ids.length === 0 ||
		ids.length > MAX_BULK_SUBSCRIBER_SELECTION ||
		ids.some((id) => !Number.isSafeInteger(id) || id < 1) ||
		new Set(ids).size !== ids.length
	) {
		throw new Error(`Subscriber resolution requires 1-${MAX_BULK_SUBSCRIBER_SELECTION} unique positive IDs.`);
	}
}

async function mapInBatches<T, R>(values: readonly T[], operation: (value: T) => Promise<R>): Promise<R[]> {
	const output: R[] = [];
	for (let offset = 0; offset < values.length; offset += PROVIDER_READ_CONCURRENCY) {
		output.push(...await Promise.all(values.slice(offset, offset + PROVIDER_READ_CONCURRENCY).map(operation)));
	}
	return output;
}

export function createListmonkSubscriberManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): SubscriberManager {
	const transport = createListmonkTransport(config, request);

	async function getRaw(id: number): Promise<SubscriberDto | null> {
		try {
			const response = await transport.json(`/subscribers/${id}`);
			const subscriber = parse(subscriberResponseSchema, response, 'subscriber detail').data;
			if (subscriber.id !== id) throw new Error('Listmonk returned the wrong subscriber detail.');
			return subscriber;
		} catch (error) {
			// Listmonk v6 reports a missing valid subscriber ID as 400; accept 404
			// as the conventional equivalent without hiding any other failure.
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) return null;
			if (error instanceof ListmonkHttpFailure) throw new SubscriberProviderFailure(error.status);
			throw error;
		}
	}

	async function get(id: number): Promise<SubscriberDetail | null> {
		const subscriber = await getRaw(id);
		return subscriber ? normalizeDetail(subscriber) : null;
	}

	async function getMembershipTarget(id: number) {
		try {
			const list = parse(
				mailingListTargetResponseSchema,
				await transport.json(`/lists/${id}`),
				'mailing-list membership target',
			).data;
			if (list.id !== id) throw new Error('Listmonk returned the wrong mailing-list membership target.');
			if (list.status !== 'active' || list.type === 'temporary') {
				throw new SubscriberProviderFailure(422);
			}
			return list;
		} catch (error) {
			if (error instanceof ListmonkHttpFailure && [400, 404].includes(error.status)) {
				throw new SubscriberProviderFailure(422);
			}
			throw error;
		}
	}

	async function requireVersions(subscribers: readonly SubscriberVersion[]): Promise<SubscriberDto[]> {
		requireBoundedUniqueIds(subscribers.map(({ id }) => id));
		const current = await mapInBatches(subscribers, async ({ id }) => {
			const subscriber = await getRaw(id);
			if (!subscriber) throw new SubscriberProviderFailure(404);
			return subscriber;
		});
		for (let index = 0; index < current.length; index += 1) {
			if (current[index]?.updated_at !== subscribers[index]?.expectedUpdatedAt) {
				throw new SubscriberProviderFailure(409);
			}
		}
		return current;
	}

	return {
		async list(input): Promise<SubscriberPage> {
			return providerCall(async () => {
				const literalSearch = input.search.trim();
				const providerSearch = escapeProviderSearch(literalSearch);

				async function readPage(page: number) {
					const query = new URLSearchParams({
						page: String(page),
						per_page: String(SUBSCRIBER_PAGE_SIZE),
					});
					if (providerSearch !== '') query.set('search', providerSearch);
					const response = parse(
						subscriberCatalogResponseSchema,
						await transport.json(`/subscribers?${query.toString()}`),
						'subscriber catalog',
					).data;
					if (response.page !== page || response.per_page !== SUBSCRIBER_PAGE_SIZE) {
						throw new Error('Listmonk did not honor the bounded subscriber page request.');
					}
					if (response.query !== '') throw new Error('Listmonk unexpectedly applied a subscriber SQL query.');
					if (response.search !== providerSearch) throw new Error('Listmonk did not honor the subscriber search request.');
					const ids = response.results.map(({ id }) => id);
					if (new Set(ids).size !== ids.length) throw new Error('Listmonk returned duplicate subscribers.');
					if (response.results.length > response.total) {
						throw new Error('Listmonk returned inconsistent subscriber page metadata.');
					}
					return response;
				}

				let response = await readPage(input.page);
				const lastPage = Math.max(1, Math.ceil(response.total / SUBSCRIBER_PAGE_SIZE));
				if (input.page > lastPage) response = await readPage(lastPage);
				return {
					items: response.results.map(normalizeSummary),
					total: response.total,
					page: response.page,
					pageSize: SUBSCRIBER_PAGE_SIZE,
					search: literalSearch,
				};
			});
		},
		get,
		async create(input): Promise<SubscriberDetail> {
			return providerCall(async () => {
				// Listmonk v6's ordinary create path makes every selected membership
				// unconfirmed and may synchronously send double-opt-in mail. Resolve the
				// targets first, create only the identity, then apply explicit membership
				// statuses through the side-effect-free membership endpoint.
				const targets = await mapInBatches(input.listIds, getMembershipTarget);
				// Recheck this invariant at the provider boundary. A list owner can
				// change single to double opt-in after the service catalog read.
				if (
					input.status === 'disabled' &&
					!input.preconfirmSubscriptions &&
					targets.some(({ optin }) => optin === 'double')
				) {
					throw new SubscriberProviderFailure(422);
				}
				const confirmedAdds = input.preconfirmSubscriptions
					? input.listIds
					: targets.filter(({ optin }) => optin === 'single').map(({ id }) => id);
				const unconfirmedAdds = input.preconfirmSubscriptions
					? []
					: targets.filter(({ optin }) => optin === 'double').map(({ id }) => id);
				let response: unknown;
				try {
					response = await transport.json('/subscribers', {
						method: 'POST',
						body: JSON.stringify({
							email: input.email,
							name: input.name,
							status: input.status,
							lists: [],
							attribs: {},
							preconfirm_subscriptions: false,
						}),
					});
				} catch (error) {
					// A provider-side validation/conflict response proves rejection. Network
					// failures and 5xx responses are ambiguous: the durable identity may exist.
					if (error instanceof ListmonkHttpFailure && error.status < 500) throw error;
					throw new SubscriberPartialMutationFailure();
				}
				let created: SubscriberDto;
				try {
					created = parse(subscriberResponseSchema, response, 'created subscriber identity').data;
					if (created.email !== input.email || created.status !== input.status) {
						throw new Error('Listmonk did not apply the created subscriber identity and status.');
					}
					if (input.name !== '' && created.name !== input.name) {
						throw new Error('Listmonk did not apply the created subscriber name.');
					}
					requireExactMemberships(created, [], 'created subscriber identity');
					if (canonicalJson(created.attribs) !== '{}') {
						throw new Error('Listmonk did not apply the created subscriber attributes.');
					}
				} catch {
					// POST completed, so even an invalid acknowledgement may represent a
					// durable identity that the operator must inspect before retrying.
					throw new SubscriberPartialMutationFailure();
				}

				async function add(targetListIds: number[], status?: 'confirmed'): Promise<void> {
					if (targetListIds.length === 0) return;
					try {
						parse(
							trueResponseSchema,
							await transport.json('/subscribers/lists', {
								method: 'PUT',
								body: JSON.stringify({
									ids: [created.id],
									target_list_ids: targetListIds,
									action: 'add',
									...(status ? { status } : {}),
								}),
							}),
							'created subscriber memberships',
						);
					} catch {
						throw new SubscriberPartialMutationFailure();
					}
				}

				await add(confirmedAdds, 'confirmed');
				await add(unconfirmedAdds);
				if (input.listIds.length === 0) return normalizeDetail(created);

				let completed: SubscriberDto | null;
				try {
					completed = await getRaw(created.id);
					if (!completed) throw new Error('Created subscriber disappeared before verification.');
					requireExactMemberships(completed, input.listIds, 'created subscriber');
					requireMembershipStates(
						completed,
						new Map<number, { status: 'confirmed' | 'unconfirmed' }>([
							...confirmedAdds.map((id) => [id, { status: 'confirmed' as const }] as const),
							...unconfirmedAdds.map((id) => [id, { status: 'unconfirmed' as const }] as const),
						]),
						'created subscriber',
					);
				} catch {
					throw new SubscriberPartialMutationFailure();
				}
				return normalizeDetail(completed);
			});
		},
		async updateProfile(input): Promise<SubscriberDetail> {
			return providerCall(async () => {
				const current = await getRaw(input.id);
				if (!current) throw new SubscriberProviderFailure(404);
				if (current.updated_at !== input.expectedUpdatedAt) throw new SubscriberProviderFailure(409);
				const completeListIds = current.lists.map(({ id }) => id);
				if (current.lists.some((membership) =>
					membership.subscription_status === 'unconfirmed' &&
					membership.optin === 'double'
				)) {
					// With false, Listmonk may send confirmation mail; with true, it
					// silently confirms these memberships. Neither is an ordinary edit.
					throw new SubscriberProviderFailure(409);
				}
				const response = await transport.json(`/subscribers/${input.id}`, {
					method: 'PUT',
					body: JSON.stringify({
						email: input.email,
						name: input.name,
						status: input.status,
						lists: completeListIds,
						attribs: current.attribs,
						preconfirm_subscriptions: false,
					}),
				});
				const updated = parse(subscriberResponseSchema, response, 'updated subscriber').data;
				if (updated.id !== input.id || updated.email !== input.email || updated.status !== input.status) {
					throw new Error('Listmonk did not apply the updated subscriber identity and status.');
				}
				const effectiveName = input.name === '' ? current.name : input.name;
				if (updated.name !== effectiveName || canonicalJson(updated.attribs) !== canonicalJson(current.attribs)) {
					throw new Error('Listmonk did not preserve the updated subscriber profile.');
				}
				requireExactMemberships(updated, completeListIds, 'updated subscriber');
				const currentMemberships = new Map(current.lists.map((membership) => [membership.id, membership]));
				requireMembershipStates(
					updated,
					new Map(completeListIds.map((id) => {
						const retained = currentMemberships.get(id);
						return [id, {
							status: input.status === 'blocklisted'
								? 'unsubscribed' as const
								: retained?.subscription_status ?? 'unconfirmed' as const,
							meta: retained?.subscription_meta,
						}];
					})),
					'updated subscriber',
				);
				return normalizeDetail(updated);
			});
		},
		async updateMemberships(input): Promise<SubscriberDetail> {
			return providerCall(async () => {
				const current = await getRaw(input.id);
				if (!current) throw new SubscriberProviderFailure(404);
				if (
					current.updated_at !== input.expectedUpdatedAt ||
					membershipVersion(current) !== input.expectedMembershipVersion
				) {
					throw new SubscriberProviderFailure(409);
				}
				if (current.status === 'blocklisted') throw new SubscriberProviderFailure(409);
				const protectedIds = current.lists
					.filter((membership) =>
						membership.restricted === true ||
						membership.type === 'temporary' ||
						membership.status === 'archived' ||
						membership.subscription_status === 'unsubscribed'
					)
					.map(({ id }) => id);
				const completeListIds = [...new Set([...input.listIds, ...protectedIds])];
				if (completeListIds.length > MAX_SUBSCRIBER_MEMBERSHIPS) {
					throw new SubscriberProviderFailure(409);
				}
				const currentById = new Map(current.lists.map((membership) => [membership.id, membership]));
				const additions = completeListIds.filter((id) => !currentById.has(id));
				const unsubscriptions = current.lists
					.filter((membership) => !completeListIds.includes(membership.id))
					.map(({ id }) => id);
				const targets = await mapInBatches(additions, getMembershipTarget);
				const targetsById = new Map(targets.map((target) => [target.id, target]));
				const confirmedAdds = targets.filter(({ optin }) => optin === 'single').map(({ id }) => id);
				const unconfirmedAdds = targets.filter(({ optin }) => optin === 'double').map(({ id }) => id);
				const beforeMutation = await getRaw(input.id);
				if (!beforeMutation || membershipVersion(beforeMutation) !== input.expectedMembershipVersion) {
					throw new SubscriberProviderFailure(409);
				}

				async function mutate(action: 'add' | 'unsubscribe', targetListIds: number[], status?: 'confirmed') {
					if (targetListIds.length === 0) return;
					try {
						parse(
							trueResponseSchema,
							await transport.json('/subscribers/lists', {
								method: 'PUT',
								body: JSON.stringify({
									ids: [input.id],
									target_list_ids: targetListIds,
									action,
									...(status ? { status } : {}),
								}),
							}),
							`${action} subscriber memberships`,
						);
					} catch {
						throw new SubscriberPartialMutationFailure();
					}
				}

				// Listmonk v6 has no membership CAS. Despite the second fresh read,
				// an explicit confirmed single-opt-in add can overwrite a row created or
				// unsubscribed concurrently before this call, and post-verification cannot
				// identify that exact interleaving. This is the accepted best-effort limit
				// until the provider exposes a conditional membership mutation.
				await mutate('add', confirmedAdds, 'confirmed');
				// Blank status inserts a new row as unconfirmed but preserves any row
				// concurrently created as confirmed/unsubscribed via ON CONFLICT.
				await mutate('add', unconfirmedAdds);
				await mutate('unsubscribe', unsubscriptions);
				if (additions.length === 0 && unsubscriptions.length === 0) return normalizeDetail(current);

				const updated = await getRaw(input.id).catch(() => { throw new SubscriberPartialMutationFailure(); });
				if (!updated) throw new SubscriberPartialMutationFailure();
				try {
					const finalMembershipIds = [...new Set([...completeListIds, ...unsubscriptions])];
					requireExactMemberships(updated, finalMembershipIds, 'updated subscriber');
					for (const membership of updated.lists) {
						const target = targetsById.get(membership.id);
						if (target && (
							membership.type !== target.type ||
							membership.optin !== target.optin ||
							membership.status !== 'active' ||
							membership.type === 'temporary'
						)) {
							throw new SubscriberPartialMutationFailure();
						}
					}
					const additionStatuses = new Map<number, 'confirmed' | 'unconfirmed'>([
						...confirmedAdds.map((id) => [id, 'confirmed'] as const),
						...unconfirmedAdds.map((id) => [id, 'unconfirmed'] as const),
					]);
					requireMembershipStates(
						updated,
						new Map(finalMembershipIds.map((id) => {
							const retained = currentById.get(id);
							return [id, retained
								? {
									status: unsubscriptions.includes(id) ? 'unsubscribed' as const : retained.subscription_status,
									meta: retained.subscription_meta,
								}
								: { status: additionStatuses.get(id) ?? 'unconfirmed' }];
						})),
						'updated subscriber',
					);
				} catch {
					throw new SubscriberPartialMutationFailure();
				}
				return normalizeDetail(updated);
			});
		},
		async delete(subscribers): Promise<void> {
			await providerCall(async () => {
				await requireVersions(subscribers);
				const query = new URLSearchParams();
				for (const { id } of subscribers) query.append('id', String(id));
				parse(
					trueResponseSchema,
					await transport.json(`/subscribers?${query.toString()}`, { method: 'DELETE' }),
					'deleted subscribers',
				);
				const remaining = await mapInBatches(subscribers, ({ id }) => getRaw(id));
				if (remaining.some((subscriber) => subscriber !== null)) {
					throw new Error('Listmonk acknowledged subscriber deletion without deleting every requested subscriber.');
				}
			});
		},
		async blocklist(subscribers): Promise<void> {
			await providerCall(async () => {
				await requireVersions(subscribers);
				parse(
					trueResponseSchema,
					await transport.json('/subscribers/blocklist', {
						method: 'PUT',
						body: JSON.stringify({ ids: subscribers.map(({ id }) => id) }),
					}),
					'blocklisted subscribers',
				);
				const updated = await mapInBatches(subscribers, async ({ id }) => {
					const subscriber = await getRaw(id);
					if (!subscriber) throw new SubscriberProviderFailure(404);
					return subscriber;
				});
				if (updated.some((subscriber) =>
					subscriber.status !== 'blocklisted' ||
					subscriber.lists.some((membership) => membership.subscription_status !== 'unsubscribed')
				)) {
					throw new Error('Listmonk acknowledged blocklisting without applying its complete subscription effect.');
				}
			});
		},
		async activity(id): Promise<SubscriberActivity | null> {
			return providerCall(async () => {
				if (!await getRaw(id)) return null;
				const response = parse(
					subscriberActivityResponseSchema,
					await transport.json(`/subscribers/${id}/activity`),
					'subscriber activity',
				).data;
				return normalizeActivity(response);
			});
		},
		async requestOptIn({ id, expectedUpdatedAt, expectedMembershipVersion }): Promise<void> {
			await providerCall(async () => {
				const current = await getRaw(id);
				if (!current) throw new SubscriberProviderFailure(404);
				if (
					current.updated_at !== expectedUpdatedAt ||
					membershipVersion(current) !== expectedMembershipVersion
				) throw new SubscriberProviderFailure(409);
				if (
					current.status !== 'enabled' ||
					!current.lists.some((membership) =>
						membership.subscription_status === 'unconfirmed' && membership.optin === 'double'
					)
				) {
					throw new SubscriberProviderFailure(409);
				}
				let response: unknown;
				try {
					response = await transport.json(`/subscribers/${id}/optin`, { method: 'POST' });
				} catch (error) {
					if (error instanceof ListmonkHttpFailure && error.status < 500) throw error;
					throw new SubscriberAmbiguousOptInFailure();
				}
				try {
					parse(trueResponseSchema, response, 'subscriber opt-in request');
				} catch {
					throw new SubscriberAmbiguousOptInFailure();
				}
			});
		},
	};
}
