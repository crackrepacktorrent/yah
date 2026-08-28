import { decodeOpaqueRouteSegment, encodeOpaqueRouteSegment } from '~/platform/opaque-route-segment';

export function encodeShortlinkRouteCode(shortCode: string): string {
	return encodeOpaqueRouteSegment(shortCode);
}

export function decodeShortlinkRouteCode(routeCode: string): string {
	return decodeOpaqueRouteSegment(routeCode);
}

export function shortlinkDetailHref(shortCode: string): string {
	return `/shortlinks/${encodeShortlinkRouteCode(shortCode)}/details`;
}

export function shortlinkEditHref(shortCode: string): string {
	return `/shortlinks/${encodeShortlinkRouteCode(shortCode)}/edit`;
}
