import { decodeOpaqueRouteSegment, encodeOpaqueRouteSegment } from '~/platform/opaque-route-segment';

export function encodeMemberRouteId(memberId: string): string {
	return encodeOpaqueRouteSegment(memberId);
}

export function decodeMemberRouteId(routeId: string): string {
	return decodeOpaqueRouteSegment(routeId);
}

export function memberRolesHref(memberId: string): string {
	return `/members/${encodeMemberRouteId(memberId)}/roles`;
}
