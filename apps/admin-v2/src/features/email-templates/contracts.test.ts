import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { PreviewNewEmailTemplateCommandSchema } from './contracts';

describe('email-template command contracts', () => {
	it('enforces the body limit in UTF-8 bytes rather than JavaScript characters', () => {
		const command = (body: string) => ({ kind: 'tx' as const, body });

		expect(v.safeParse(PreviewNewEmailTemplateCommandSchema, command('é'.repeat(2_500_000))).success).toBe(true);
		const oversized = v.safeParse(PreviewNewEmailTemplateCommandSchema, command('é'.repeat(2_500_001)));
		expect(oversized.success).toBe(false);
		if (!oversized.success) expect(oversized.issues[0]?.message).toBe('Template HTML is too large.');
	});
});
