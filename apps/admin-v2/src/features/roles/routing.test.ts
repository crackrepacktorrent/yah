import { describe, expect, it } from 'vitest';
import { decodeRoleRouteId, roleCloneHref, roleDetailsHref } from './routing';

describe('role management routes', () => {
	it.each(['builtin:owner', 'custom role', '%2F', 'new'])('round-trips %j through opaque paths', (roleId) => {
		for (const href of [roleDetailsHref(roleId), roleCloneHref(roleId)]) {
			const segment = href.split('/')[2] ?? '';
			expect(decodeRoleRouteId(segment)).toBe(roleId);
			expect(segment).toMatch(/^~h[0-9a-f]+$/);
		}
	});
});
