import { describe, expect, test } from 'bun:test';
import type {
	PublicSubscriptionList,
	PublicSubscriptionRequest,
	PublicSubscriptionsGateway
} from './listmonk-public.server';
import {
	MAX_SELECTED_LISTS,
	MAX_SUBSCRIPTION_EMAIL_LENGTH,
	MAX_SUBSCRIPTION_NAME_LENGTH,
	deriveSubscriptionPageState,
	submitPublicSubscription
} from './subscription-service';

const publicLists: PublicSubscriptionList[] = [
	{ uuid: 'list-a', name: 'News' },
	{ uuid: 'list-b', name: 'Events' }
];

function form(entries: Array<[string, string]>): FormData {
	const value = new FormData();
	for (const [key, entry] of entries) value.append(key, entry);
	return value;
}

function gatewayFixture(lists = publicLists, hasOptin = false) {
	const calls = { lists: 0, subscriptions: [] as PublicSubscriptionRequest[] };
	const gateway: PublicSubscriptionsGateway = {
		async listPublicLists() {
			calls.lists += 1;
			return lists;
		},
		async subscribe(request) {
			calls.subscriptions.push(request);
			return { hasOptin };
		}
	};
	return { calls, gateway };
}

describe('public subscription service', () => {
	test('deduplicates selected lists and propagates the opt-in state', async () => {
		const { calls, gateway } = gatewayFixture(publicLists, true);
		const result = await submitPublicSubscription(
			form([
				['email', ' person@example.test '],
				['name', ' Person '],
				['list', 'list-a'],
				['list', 'list-a']
			]),
			gateway
		);

		expect(result).toEqual({ success: true, hasOptin: true });
		expect(calls.lists).toBe(1);
		expect(calls.subscriptions).toEqual([
			{ email: 'person@example.test', name: 'Person', listUuids: ['list-a'] }
		]);
	});

	test('rejects a mixed valid and invalid selection after a fresh allowlist read', async () => {
		const { calls, gateway } = gatewayFixture();
		const result = await submitPublicSubscription(
			form([
				['email', 'person@example.test'],
				['list', 'list-a'],
				['list', 'private-list']
			]),
			gateway
		);

		expect(result).toMatchObject({ success: false, status: 400 });
		expect(calls.lists).toBe(1);
		expect(calls.subscriptions).toHaveLength(0);
	});

	test('enforces email, name, unique-list-count, and per-UUID limits before upstream work', async () => {
		const invalidForms = [
			form([
				['email', `${'a'.repeat(MAX_SUBSCRIPTION_EMAIL_LENGTH - 11)}@example.test`],
				['list', 'list-a']
			]),
			form([
				['email', 'person@example.test'],
				['name', 'n'.repeat(MAX_SUBSCRIPTION_NAME_LENGTH + 1)],
				['list', 'list-a']
			]),
			form([
				['email', 'person@example.test'],
				...Array.from({ length: MAX_SELECTED_LISTS + 1 }, (_, index) => [
					'list',
					`list-${index}`
				] as [string, string])
			]),
			form([
				['email', 'person@example.test'],
				['list', 'u'.repeat(129)]
			])
		];

		for (const invalidForm of invalidForms) {
			const { calls, gateway } = gatewayFixture();
			const result = await submitPublicSubscription(invalidForm, gateway);
			expect(result).toMatchObject({ success: false, status: 400 });
			expect(calls.lists).toBe(0);
			expect(calls.subscriptions).toHaveLength(0);
		}
	});

	test('counts unique list UUIDs rather than duplicate form entries', async () => {
		const { calls, gateway } = gatewayFixture();
		const result = await submitPublicSubscription(
			form([
				['email', 'person@example.test'],
				...Array.from({ length: MAX_SELECTED_LISTS + 1 }, () => ['list', 'list-a'] as [string, string])
			]),
			gateway
		);

		expect(result).toEqual({ success: true, hasOptin: false });
		expect(calls.subscriptions[0]?.listUuids).toEqual(['list-a']);
	});

	test('returns non-enumerating honeypot success without validation or upstream calls', async () => {
		const { calls, gateway } = gatewayFixture();
		const result = await submitPublicSubscription(
			form([
				['website', 'https://bot.example'],
				['email', 'not-an-email']
			]),
			gateway
		);

		expect(result).toEqual({ success: true, hasOptin: false });
		expect(calls.lists).toBe(0);
		expect(calls.subscriptions).toHaveLength(0);
	});

	test('enforces embed scope again on submission', async () => {
		const rejected = gatewayFixture();
		const result = await submitPublicSubscription(
			form([
				['email', 'person@example.test'],
				['list', 'list-b']
			]),
			rejected.gateway,
			undefined,
			{ embedded: true, listParam: 'list-a' }
		);
		expect(result).toMatchObject({ success: false, status: 400 });
		expect(rejected.calls.lists).toBe(0);

		const accepted = gatewayFixture();
		await expect(
			submitPublicSubscription(
				form([
					['email', 'person@example.test'],
					['list', 'list-a']
				]),
				accepted.gateway,
				undefined,
				{ embedded: true, listParam: 'list-a' }
			)
		).resolves.toEqual({ success: true, hasOptin: false });
		expect(accepted.calls.lists).toBe(1);
	});
});

describe('subscription page state', () => {
	test('renders only the requested active public list in embed mode', () => {
		expect(deriveSubscriptionPageState(publicLists, 'list-b', true)).toEqual({
			lists: [{ uuid: 'list-b', name: 'Events' }],
			preselectedUuids: ['list-b'],
			available: true,
			embedded: true
		});
	});

	test('marks missing, invalid, or private-removed embed targets unavailable', () => {
		for (const listParam of [null, 'list-a,list-b', 'private-list']) {
			expect(deriveSubscriptionPageState(publicLists, listParam, true)).toEqual({
				lists: [],
				preselectedUuids: [],
				available: false,
				embedded: true
			});
		}
	});

	test('keeps every list standalone and filters preselection to the public allowlist', () => {
		expect(deriveSubscriptionPageState(publicLists, 'list-b,private-list', false)).toEqual({
			lists: publicLists,
			preselectedUuids: ['list-b'],
			available: true,
			embedded: false
		});
	});
});
