import { MAX_SUBSCRIBER_PAGE } from './contracts';
import { decodePositiveIntegerRouteSegment } from '~/platform/positive-integer-route-segment';

export function decodeSubscriberRouteId(segment: string): number {
	return decodePositiveIntegerRouteSegment(segment);
}

export function subscriberHref(id: number): string {
	return `/emails/subscribers/${id}`;
}

export function decodeSubscriberListLocation(query: Record<string, string | string[] | undefined>): { page: number; search: string } {
	const rawPage = typeof query['page'] === 'string' ? query['page'] : '';
	const parsedPage = Number(rawPage);
	const page = /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(parsedPage) && parsedPage <= MAX_SUBSCRIBER_PAGE
		? parsedPage
		: 1;
	const rawSearch = typeof query['search'] === 'string' ? query['search'] : '';
	return { page, search: rawSearch.trim().slice(0, 200) };
}

export function subscriberListHref(input: { page?: number; search?: string }): string {
	const query = new URLSearchParams();
	const search = input.search?.trim() ?? '';
	if (search) query.set('search', search);
	if ((input.page ?? 1) > 1) query.set('page', String(input.page));
	const serialized = query.toString();
	return serialized ? `/emails/subscribers?${serialized}` : '/emails/subscribers';
}
