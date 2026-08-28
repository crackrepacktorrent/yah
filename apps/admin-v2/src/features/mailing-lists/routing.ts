import { decodePositiveIntegerRouteSegment } from '~/platform/positive-integer-route-segment';

export function decodeMailingListRouteId(segment: string): number {
	return decodePositiveIntegerRouteSegment(segment);
}

export function mailingListHref(id: number): string {
	return `/emails/lists/${id}`;
}
