import 'server-only';
import * as v from 'valibot';
import { createPublicError, type PublicError } from '~/platform/errors';

/**
 * A provider returned a payload this app's contract rejects.
 *
 * These reach the operator instead of collapsing into a reference id, because
 * the field that broke is the whole diagnosis. 502: the upstream, not the
 * request, is at fault.
 *
 * Callers pass values, never a formatted message. That is the safety property:
 * the only payload-derived input is a valibot issue list, and the sole code
 * that reads it is {@link describeProviderIssue} below. A call site therefore
 * cannot interpolate a provider payload into an operator-visible string even
 * by accident.
 */
export function providerContractError(
	provider: string,
	subject: string,
	issues?: readonly v.BaseIssue<unknown>[],
): PublicError {
	return createPublicError(`${provider} returned an invalid ${subject}${describeProviderIssue(issues)}.`, 502);
}

/** Same contract, for an invariant we check by hand rather than with a schema. */
export function providerInvariantError(message: string): PublicError {
	return createPublicError(message, 502);
}

/**
 * Locate a failure using only our own schema's vocabulary.
 *
 * `path` is a chain of keys from the schema we wrote and `expected` is that
 * schema's own declaration, so both are app-authored. Valibot's `received` and
 * its default `message` are deliberately excluded: they are derived from the
 * provider payload and would put credentials, subscriber emails, or campaign
 * bodies into an operator-visible error.
 */
export function describeProviderIssue(issues: readonly v.BaseIssue<unknown>[] | undefined): string {
	const issue = issues?.[0];
	if (!issue) return '';

	const path = issue.path?.map((item) => String(item.key)).join('.');
	const expected = typeof issue.expected === 'string' ? issue.expected : undefined;
	if (path && expected) return ` at ${path} (expected ${expected})`;
	if (path) return ` at ${path}`;
	return expected ? ` (expected ${expected})` : '';
}
