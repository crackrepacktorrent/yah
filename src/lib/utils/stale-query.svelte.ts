/**
 * Holds the last non-undefined `.current` from a query so the UI
 * stays mounted while a new query (different params) is in flight.
 *
 * SvelteKit remote-function `query()` returns a new object when params
 * change, and the new object starts with `.current = undefined`.
 * This bridges the gap.
 */
export function staleWhileRevalidate<T>(getCurrent: () => T | undefined): { readonly current: T | undefined } {
	let prev: T | undefined;
	const current = $derived.by(() => {
		const val = getCurrent();
		if (val !== undefined) prev = val;
		return val ?? prev;
	});

	return {
		get current() {
			return current;
		}
	};
}
