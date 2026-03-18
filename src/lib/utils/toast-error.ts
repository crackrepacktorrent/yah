import { isHttpError } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

/**
 * Shows an error toast with the best available message from an unknown error.
 * Handles SvelteKit HttpError, standard Error, and unknown values.
 */
export function toastError(err: unknown, fallback = 'Something went wrong') {
	if (isHttpError(err)) {
		toast.error(err.body.message || fallback);
	} else if (err instanceof Error) {
		toast.error(err.message || fallback);
	} else {
		toast.error(fallback);
	}
}
