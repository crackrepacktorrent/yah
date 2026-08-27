import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createListmonkPublicSubscriptions } from '$lib/server/subscriptions/listmonk-public.server';
import {
	deriveSubscriptionPageState,
	submitPublicSubscription,
	type SubscriptionErrorReport
} from '$lib/server/subscriptions/subscription-service';

function subscriptions() {
	if (!env.LISTMONK_URL) throw new Error('LISTMONK_URL must be set');
	return createListmonkPublicSubscriptions(env.LISTMONK_URL);
}

function reportSubscriptionError(report: SubscriptionErrorReport): void {
	console.error('Listmonk public subscription failed', report);
}

export const load: PageServerLoad = async ({ url }) => {
	const embedded = url.searchParams.get('embed') === '1';
	try {
		const lists = await subscriptions().listPublicLists();
		return deriveSubscriptionPageState(lists, url.searchParams.get('list'), embedded);
	} catch {
		console.error('Listmonk public lists are unavailable');
		return deriveSubscriptionPageState([], url.searchParams.get('list'), embedded);
	}
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const result = await submitPublicSubscription(
			await request.formData(),
			subscriptions(),
			reportSubscriptionError,
			{
				embedded: url.searchParams.get('embed') === '1',
				listParam: url.searchParams.get('list')
			}
		);

		if (result.success) return result;
		return fail(result.status, {
			error: result.error,
			...result.fields,
			...(result.unavailable ? { unavailable: true as const } : {})
		});
	}
};
