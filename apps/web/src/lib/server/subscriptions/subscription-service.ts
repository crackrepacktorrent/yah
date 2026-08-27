import {
	ListmonkPublicHttpError,
	ListmonkPublicProtocolError,
	ListmonkPublicTransportError,
	MAX_LIST_UUID_LENGTH,
	type PublicSubscriptionList,
	type PublicSubscriptionsGateway
} from './listmonk-public.server';

export const MAX_SUBSCRIPTION_EMAIL_LENGTH = 320;
export const MAX_SUBSCRIPTION_NAME_LENGTH = 255;
export const MAX_SELECTED_LISTS = 20;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PreservedFields = {
	email?: string;
	name?: string;
};

export type SubscriptionSubmissionResult =
	| { success: true; hasOptin: boolean }
	| {
			success: false;
			status: 400 | 503;
			error: string;
			unavailable?: true;
			fields: PreservedFields;
	  };

export type SubscriptionPageState = {
	lists: PublicSubscriptionList[];
	preselectedUuids: string[];
	available: boolean;
	embedded: boolean;
};

export type SubscriptionScope = {
	embedded: boolean;
	listParam: string | null;
};

export type SubscriptionErrorReport = {
	operation: 'subscribe';
	kind: 'http' | 'protocol' | 'transport' | 'unknown';
	status?: number;
};

function boundedField(value: FormDataEntryValue | null, maxLength: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length <= maxLength ? trimmed : undefined;
}

function formFields(form: FormData): PreservedFields {
	return {
		email: boundedField(form.get('email'), MAX_SUBSCRIPTION_EMAIL_LENGTH),
		name: boundedField(form.get('name'), MAX_SUBSCRIPTION_NAME_LENGTH)
	};
}

function failure(error: string, fields: PreservedFields): SubscriptionSubmissionResult {
	return { success: false, status: 400, error, fields };
}

function parseSelectedListUuids(form: FormData): string[] | null {
	const rawValues = form.getAll('list');
	if (rawValues.some((value) => typeof value !== 'string')) return null;
	const values = rawValues.map((value) => String(value).trim());
	if (values.some((value) => value.length === 0 || value.length > MAX_LIST_UUID_LENGTH)) return null;
	const unique = [...new Set(values)];
	if (unique.length === 0 || unique.length > MAX_SELECTED_LISTS) return null;
	return unique;
}

function scopeAllowsSelection(listUuids: string[], scope: SubscriptionScope | undefined): boolean {
	if (!scope?.embedded) return true;
	const scopedUuids = queryListUuids(scope.listParam);
	return scopedUuids.length === 1 && listUuids.length === 1 && listUuids[0] === scopedUuids[0];
}

function safeErrorReport(error: unknown): SubscriptionErrorReport {
	if (error instanceof ListmonkPublicHttpError) {
		return { operation: 'subscribe', kind: 'http', status: error.status };
	}
	if (error instanceof ListmonkPublicProtocolError) {
		return { operation: 'subscribe', kind: 'protocol' };
	}
	if (error instanceof ListmonkPublicTransportError) {
		return { operation: 'subscribe', kind: 'transport' };
	}
	return { operation: 'subscribe', kind: 'unknown' };
}

export async function submitPublicSubscription(
	form: FormData,
	gateway: PublicSubscriptionsGateway,
	reportError: (report: SubscriptionErrorReport) => void = () => undefined,
	scope?: SubscriptionScope
): Promise<SubscriptionSubmissionResult> {
	// A bot-filled honeypot is indistinguishable from a successful submission and
	// deliberately performs no validation or upstream work.
	const honeypotValues = form.getAll('website');
	if (honeypotValues.some((value) => typeof value !== 'string' || value.length > 0)) {
		return { success: true, hasOptin: false };
	}

	const fields = formFields(form);
	const rawEmail = form.get('email');
	const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
	if (email.length === 0 || email.length > MAX_SUBSCRIPTION_EMAIL_LENGTH || !emailPattern.test(email)) {
		return failure('Please enter a valid email address.', fields);
	}

	const rawName = form.get('name');
	const name = typeof rawName === 'string' ? rawName.trim() : '';
	if (name.length > MAX_SUBSCRIPTION_NAME_LENGTH) {
		return failure(`Name must be at most ${MAX_SUBSCRIPTION_NAME_LENGTH} characters.`, fields);
	}

	const listUuids = parseSelectedListUuids(form);
	if (!listUuids) {
		return failure(`Please select between 1 and ${MAX_SELECTED_LISTS} valid lists.`, fields);
	}
	if (!scopeAllowsSelection(listUuids, scope)) {
		return failure('Please select a valid list.', fields);
	}

	try {
		// Fetch immediately before the mutation so a list made private or archived
		// since page load cannot be submitted through this public boundary.
		const publicLists = await gateway.listPublicLists();
		if (publicLists.length === 0) {
			return {
				success: false,
				status: 503,
				error: 'Subscriptions are temporarily unavailable. Please try again later.',
				unavailable: true,
				fields
			};
		}
		const allowedUuids = new Set(publicLists.map((list) => list.uuid));
		if (listUuids.some((uuid) => !allowedUuids.has(uuid))) {
			return failure('Please select a valid list.', fields);
		}

		const result = await gateway.subscribe({
			email,
			name: name || undefined,
			listUuids
		});
		return { success: true, hasOptin: result.hasOptin };
	} catch (error) {
		reportError(safeErrorReport(error));
		if (error instanceof ListmonkPublicHttpError && error.status >= 400 && error.status < 500 && error.status !== 429) {
			return failure('Please check your details and try again.', fields);
		}
		return {
			success: false,
			status: 503,
			error: 'Subscriptions are temporarily unavailable. Please try again later.',
			unavailable: true,
			fields
		};
	}
}

function queryListUuids(value: string | null): string[] {
	if (!value) return [];
	const values = value.split(',').map((uuid) => uuid.trim());
	if (values.some((uuid) => uuid.length === 0 || uuid.length > MAX_LIST_UUID_LENGTH)) return [];
	const unique = [...new Set(values)];
	return unique.length <= MAX_SELECTED_LISTS ? unique : [];
}

export function deriveSubscriptionPageState(
	lists: PublicSubscriptionList[],
	listParam: string | null,
	embedded: boolean
): SubscriptionPageState {
	const requestedUuids = queryListUuids(listParam);
	const byUuid = new Map(lists.map((list) => [list.uuid, list]));

	if (embedded) {
		if (requestedUuids.length !== 1) {
			return { lists: [], preselectedUuids: [], available: false, embedded: true };
		}
		const selected = byUuid.get(requestedUuids[0]!);
		if (!selected) return { lists: [], preselectedUuids: [], available: false, embedded: true };
		return {
			lists: [selected],
			preselectedUuids: [selected.uuid],
			available: true,
			embedded: true
		};
	}

	return {
		lists,
		preselectedUuids: requestedUuids.filter((uuid) => byUuid.has(uuid)),
		available: lists.length > 0,
		embedded: false
	};
}
