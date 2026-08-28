import { isPublicError } from '~/platform/errors';

/** Preserve intentionally public server errors without exposing infrastructure details. */
export function visibleError(error: unknown, fallback: string): string {
	return isPublicError(error) ? error.message : fallback;
}
