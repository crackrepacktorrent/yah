import { decodePositiveIntegerRouteSegment } from '~/platform/positive-integer-route-segment';

export function decodeEmailTemplateRouteId(segment: string): number {
	return decodePositiveIntegerRouteSegment(segment);
}

export function emailTemplateHref(id: number): string {
	return `/emails/templates/${id}`;
}
