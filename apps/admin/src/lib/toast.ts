import { Toaster, toast } from 'solid-sonner';

export { Toaster, toast };

/** Show a toast with the error message, falling back to the provided default. */
export function toastError(error: unknown, fallback: string): void {
	if (error instanceof Error) {
		toast.error(error.message);
	} else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
		toast.error(error.message);
	} else {
		toast.error(fallback);
	}
}
