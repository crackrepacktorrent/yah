import { decodeOpaqueRouteSegment, encodeOpaqueRouteSegment } from '~/platform/opaque-route-segment';

export function decodeRoleRouteId(segment: string): string {
	return decodeOpaqueRouteSegment(segment);
}

export function roleDetailsHref(roleId: string): string {
	return `/roles/${encodeOpaqueRouteSegment(roleId)}/edit`;
}

export function roleCloneHref(roleId: string): string {
	return `/roles/${encodeOpaqueRouteSegment(roleId)}/clone`;
}
