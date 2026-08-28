import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
	CampaignTestSendAmbiguousFailure,
	CampaignTestSendPreconditionFailure,
	isCampaignTestSendAmbiguousFailure,
	isCampaignTestSendPreconditionFailure,
	SendCampaignTestCommandSchema,
} from './contracts';

const validCommand = {
	campaignId: 21,
	expectedCampaignUpdatedAt: '2026-08-25T11:00:00Z',
	subscriberId: 31,
	expectedSubscriberUpdatedAt: '2026-08-25T12:00:00.123456Z',
};

describe('campaign test-send contracts', () => {
	it('accepts only the bounded server command needed to resolve one campaign and subscriber', () => {
		expect(v.safeParse(SendCampaignTestCommandSchema, validCommand)).toMatchObject({
			success: true,
			output: validCommand,
		});
	});

	it('rejects unknown fields and invalid campaign or subscriber IDs', () => {
		const invalidInputs = [
			{ ...validCommand, unexpected: true },
			{ ...validCommand, campaignId: 0 },
			{ ...validCommand, campaignId: 1.5 },
			{ ...validCommand, campaignId: Number.MAX_SAFE_INTEGER + 1 },
			{ ...validCommand, subscriberId: Number.NaN },
			{ ...validCommand, subscriberId: Number.POSITIVE_INFINITY },
			{ ...validCommand, subscriberId: '31' },
		];

		for (const input of invalidInputs) {
			expect(v.safeParse(SendCampaignTestCommandSchema, input).success).toBe(false);
		}
	});

	it('requires real, timezone-qualified provider timestamps', () => {
		const invalidVersions = [
			'',
			'not-a-date',
			'2026-08-25',
			'2026-08-25T11:00:00',
			'2026-02-30T11:00:00Z',
			'2026-13-01T11:00:00Z',
			`2026-08-25T11:00:00.${'1'.repeat(65)}Z`,
		];

		for (const version of invalidVersions) {
			expect(v.safeParse(SendCampaignTestCommandSchema, {
				...validCommand,
				expectedCampaignUpdatedAt: version,
			}).success).toBe(false);
			expect(v.safeParse(SendCampaignTestCommandSchema, {
				...validCommand,
				expectedSubscriberUpdatedAt: version,
			}).success).toBe(false);
		}
	});

	it('recognizes local and lazy-chunk-compatible typed failures without accepting unknown reasons', () => {
		for (const error of [
			new CampaignTestSendPreconditionFailure('campaign-stale'),
			{ name: 'CampaignTestSendPreconditionFailure', reason: 'subscriber-membership' },
		]) {
			expect(isCampaignTestSendPreconditionFailure(error)).toBe(true);
		}
		expect(isCampaignTestSendPreconditionFailure({
			name: 'CampaignTestSendPreconditionFailure',
			reason: 'invented-reason',
		})).toBe(false);
		expect(isCampaignTestSendPreconditionFailure({
			name: 'CampaignTestSendPreconditionFailure',
		})).toBe(false);

		expect(isCampaignTestSendAmbiguousFailure(new CampaignTestSendAmbiguousFailure())).toBe(true);
		expect(isCampaignTestSendAmbiguousFailure({ name: 'CampaignTestSendAmbiguousFailure' })).toBe(true);
		expect(isCampaignTestSendAmbiguousFailure({ name: 'Error' })).toBe(false);
	});
});
