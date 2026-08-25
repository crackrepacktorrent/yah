import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';

const listmonkUrl = () => {
	const url = env.LISTMONK_URL;
	if (!url) throw new Error('LISTMONK_URL must be set');
	return url.replace(/\/+$/, '');
};

type PublicList = { uuid: string; name: string };
const UPSTREAM_TIMEOUT_MS = 8_000;

async function getPublicLists(): Promise<PublicList[]> {
	const response = await fetch(`${listmonkUrl()}/api/public/lists`, {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`Listmonk lists request failed with ${response.status}`);

	const value: unknown = await response.json();
	if (!Array.isArray(value)) throw new Error('Listmonk lists response was not an array');
	return value.filter(
		(list): list is PublicList =>
			typeof list === 'object' &&
			list !== null &&
			typeof (list as PublicList).uuid === 'string' &&
			Boolean((list as PublicList).uuid) &&
			typeof (list as PublicList).name === 'string'
	);
}

export const load: PageServerLoad = async ({ url }) => {
	const listParam = url.searchParams.get('list');
	const preselectedUuids = listParam ? listParam.split(',').filter(Boolean) : [];

	let lists: PublicList[] = [];
	try {
		lists = await getPublicLists();
	} catch (reason) {
		console.error('Listmonk public lists are unavailable', reason);
	}

	const allowedUuids = new Set(lists.map((list) => list.uuid));
	return {
		lists,
		preselectedUuids: preselectedUuids.filter((uuid) => allowedUuids.has(uuid)),
		available: lists.length > 0
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = form.get('email')?.toString()?.trim();
		const name = form.get('name')?.toString()?.trim();
		const listUuids = [...new Set(form.getAll('list').map(String).filter(Boolean))];

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'Please enter a valid email address.', email, name });
		}

		if (listUuids.length === 0) {
			return fail(400, { error: 'Please select at least one list.', email, name });
		}

		try {
			const publicLists = await getPublicLists();
			const allowedUuids = new Set(publicLists.map((list) => list.uuid));
			if (publicLists.length === 0) {
				return fail(503, {
					error: 'Subscriptions are temporarily unavailable. Please try again later.',
					email,
					name,
					unavailable: true
				});
			}
			if (listUuids.some((uuid) => !allowedUuids.has(uuid))) {
				return fail(400, { error: 'Please select a valid list.', email, name });
			}

			const res = await fetch(`${listmonkUrl()}/api/public/subscription`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
				body: JSON.stringify({
					email,
					name: name || undefined,
					list_uuids: listUuids,
				}),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => '');
				console.error('Listmonk subscription failed:', res.status, text);
				return fail(500, { error: 'Something went wrong. Please try again.', email, name });
			}
		} catch (reason) {
			console.error('Listmonk subscription request failed', reason);
			return fail(503, {
				error: 'Subscriptions are temporarily unavailable. Please try again later.',
				email,
				name,
				unavailable: true
			});
		}

		return { success: true };
	},
};
