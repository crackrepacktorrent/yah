import * as v from 'valibot';

const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const qualifiedProviderTimestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function isProviderTimestamp(value: string): boolean {
	const match = qualifiedProviderTimestamp.exec(value);
	if (!match || !Number.isFinite(Date.parse(value))) return false;
	const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	if (!offsetText || hour > 23 || minute > 59 || second > 59) return false;
	if (offsetText !== 'Z') {
		const [offsetHour, offsetMinute] = offsetText.slice(1).split(':').map(Number);
		if ((offsetHour ?? 24) > 23 || (offsetMinute ?? 60) > 59) return false;
	}
	const calendarDate = new Date(0);
	calendarDate.setUTCFullYear(year, month - 1, day);
	calendarDate.setUTCHours(0, 0, 0, 0);
	return (
		calendarDate.getUTCFullYear() === year &&
		calendarDate.getUTCMonth() === month - 1 &&
		calendarDate.getUTCDate() === day
	);
}

const providerVersion = v.pipe(
	v.string(),
	v.maxLength(64),
	v.check(isProviderTimestamp, 'Use a valid timezone-qualified provider version.'),
);

export const SendCampaignTestCommandSchema = v.strictObject({
	campaignId: positiveInteger,
	expectedCampaignUpdatedAt: providerVersion,
	subscriberId: positiveInteger,
	expectedSubscriberUpdatedAt: providerVersion,
});

export type SendCampaignTestCommand = v.InferOutput<typeof SendCampaignTestCommandSchema>;

export type CampaignTestSendPrecondition =
	| 'campaign-not-found'
	| 'subscriber-not-found'
	| 'campaign-stale'
	| 'subscriber-stale'
	| 'campaign-type'
	| 'campaign-status'
	| 'campaign-messenger'
	| 'subscriber-status'
	| 'subscriber-membership'
	| 'provider-rejected';

const campaignTestSendPreconditions = new Set<string>([
	'campaign-not-found',
	'subscriber-not-found',
	'campaign-stale',
	'subscriber-stale',
	'campaign-type',
	'campaign-status',
	'campaign-messenger',
	'subscriber-status',
	'subscriber-membership',
	'provider-rejected',
]);

/** A definite, diagnostic-free rejection that is safe for the service to classify. */
export class CampaignTestSendPreconditionFailure extends Error {
	constructor(public readonly reason: CampaignTestSendPrecondition) {
		super(`Campaign test-send precondition failed: ${reason}.`);
		this.name = 'CampaignTestSendPreconditionFailure';
	}
}

/** Listmonk may have queued the message even though its acknowledgement was lost. */
export class CampaignTestSendAmbiguousFailure extends Error {
	constructor() {
		super('Listmonk may have queued the campaign test email.');
		this.name = 'CampaignTestSendAmbiguousFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isCampaignTestSendPreconditionFailure(error: unknown): error is CampaignTestSendPreconditionFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'CampaignTestSendPreconditionFailure' &&
		'reason' in error &&
		typeof error.reason === 'string' &&
		campaignTestSendPreconditions.has(error.reason)
	);
}

export function isCampaignTestSendAmbiguousFailure(error: unknown): error is CampaignTestSendAmbiguousFailure {
	return typeof error === 'object' && error !== null && 'name' in error && error.name === 'CampaignTestSendAmbiguousFailure';
}
