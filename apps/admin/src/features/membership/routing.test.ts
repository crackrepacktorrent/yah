import { describe, expect, it } from 'vitest';
import { decodeMemberRouteId, encodeMemberRouteId, memberRolesHref } from './routing';

describe('membership route identifiers', () => {
	it.each(['member-1', 'new', '.', '..', 'member/with?reserved#characters', 'สมาชิก'])('round-trips %s', (memberId) => {
		const encoded = encodeMemberRouteId(memberId);
		expect(encoded).toMatch(/^~h[0-9a-f]+$/);
		expect(decodeMemberRouteId(encoded)).toBe(memberId);
		expect(memberRolesHref(memberId)).toBe(`/members/${encoded}/roles`);
	});

	it.each(['', 'member-1', '~h', '~h0', '~hgg', '~hff'])('rejects invalid opaque segment %s', (segment) => {
		expect(decodeMemberRouteId(segment)).toBe('');
	});
});
