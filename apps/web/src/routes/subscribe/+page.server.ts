import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';

const listmonkUrl = () => {
	const url = env.LISTMONK_URL;
	if (!url) throw new Error('LISTMONK_URL must be set');
	return url.replace(/\/+$/, '');
};

export const load: PageServerLoad = async ({ url }) => {
	const listParam = url.searchParams.get('list');
	const preselectedUuids = listParam ? listParam.split(',').filter(Boolean) : [];

	let lists: { uuid: string; name: string }[] = [];
	try {
		const res = await fetch(`${listmonkUrl()}/api/public/lists`);
		if (res.ok) {
			lists = await res.json();
		}
	} catch {
		// If Listmonk is down, show empty list
	}

	return { lists, preselectedUuids };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = form.get('email')?.toString()?.trim();
		const name = form.get('name')?.toString()?.trim();
		const listUuids = form.getAll('list').map(String).filter(Boolean);

		if (!email) {
			return fail(400, { error: 'Email is required.', email, name });
		}

		if (listUuids.length === 0) {
			return fail(400, { error: 'Please select at least one list.', email, name });
		}

		try {
			const res = await fetch(`${listmonkUrl()}/api/public/subscription`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
		} catch {
			return fail(500, { error: 'Something went wrong. Please try again.', email, name });
		}

		return { success: true };
	},
};
