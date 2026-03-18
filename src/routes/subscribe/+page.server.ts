import type { Actions, PageServerLoad } from './$types';
import { getListmonk } from '$lib/server/listmonk';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const listParam = url.searchParams.get('list');
	const listIds = listParam
		? listParam.split(',').map(Number).filter((n) => !isNaN(n) && n > 0)
		: [];

	// Fetch public lists so the form can show checkboxes
	let lists: { id: number; name: string; type: string }[] = [];
	try {
		const allLists = await getListmonk().listLists();
		lists = allLists
			.filter((l) => l.type === 'public')
			.map((l) => ({ id: l.id, name: l.name, type: l.type }));
	} catch {
		// If Listmonk is down, show empty list
	}

	return { lists, preselectedListIds: listIds };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = form.get('email')?.toString()?.trim();
		const name = form.get('name')?.toString()?.trim();
		const listIds = form.getAll('list').map(Number).filter((n) => !isNaN(n) && n > 0);

		if (!email) {
			return fail(400, { error: 'Email is required.', email, name });
		}

		if (listIds.length === 0) {
			return fail(400, { error: 'Please select at least one list.', email, name });
		}

		try {
			await getListmonk().createSubscriber({
				email,
				name: name || undefined,
				status: 'enabled',
				lists: listIds,
			});
		} catch (err: any) {
			// Listmonk returns 409 if subscriber already exists — that's fine,
			// the subscriber just gets added to the new lists
			if (err?.status !== 409) {
				const message = err?.message?.includes('409')
					? undefined // treat as success
					: 'Something went wrong. Please try again.';
				if (message) {
					return fail(500, { error: message, email, name });
				}
			}
		}

		return { success: true };
	},
};
