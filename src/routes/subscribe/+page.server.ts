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

		// Validate that submitted list IDs are actually public lists
		const allLists = await getListmonk().listLists();
		const publicIds = new Set(allLists.filter((l) => l.type === 'public').map((l) => l.id));
		const validListIds = listIds.filter((id) => publicIds.has(id));
		if (validListIds.length === 0) {
			return fail(400, { error: 'Invalid list selection.', email, name });
		}

		try {
			await getListmonk().createSubscriber({
				email,
				name: name || undefined,
				status: 'enabled',
				lists: validListIds,
			});
		} catch (err: any) {
			if (err?.status === 409 || err?.message?.includes('409')) {
				// Subscriber already exists — add them to the requested lists
				try {
					const lm = getListmonk();
					const escaped = email!.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
					const res = await lm.listSubscribers({ query: `subscribers.email ILIKE '${escaped}'` });
					const existing = res.data.results[0];
					if (existing) {
						const currentListIds = existing.lists.map((l: { id: number }) => l.id);
						const newListIds = [...new Set([...currentListIds, ...validListIds])];
						await lm.updateSubscriber(existing.id, { lists: newListIds });
					}
				} catch {
					// Best effort — if update fails, the subscriber still exists
				}
				return { success: true };
			}
			return fail(500, { error: 'Something went wrong. Please try again.', email, name });
		}

		return { success: true };
	},
};
