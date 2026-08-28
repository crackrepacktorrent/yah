import * as v from 'valibot';

export const BOUNCE_PAGE_SIZE = 50;
export const MAX_BOUNCE_PAGE = 10_000;
export const MAX_BULK_BOUNCE_SELECTION = 100;

const bounceId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid bounce.'));
const subscriberId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid subscriber.'));
const bounceIds = v.pipe(
	v.array(bounceId),
	v.minLength(1, 'Select at least one bounce.'),
	v.maxLength(
		MAX_BULK_BOUNCE_SELECTION,
		`Select at most ${MAX_BULK_BOUNCE_SELECTION} bounces at once.`,
	),
	v.check((values) => new Set(values).size === values.length, 'Select each bounce only once.'),
);

export const BounceSubscriberIdSchema = subscriberId;
export const BounceTypeSchema = v.picklist(['hard', 'soft', 'complaint'] as const);
export const ListBouncesQuerySchema = v.strictObject({
	page: v.pipe(
		v.number(),
		v.safeInteger(),
		v.minValue(1, 'Select a valid bounce page.'),
		v.maxValue(MAX_BOUNCE_PAGE, 'Select a valid bounce page.'),
	),
});
export const DeleteBouncesCommandSchema = v.strictObject({ ids: bounceIds });

export type BounceType = v.InferOutput<typeof BounceTypeSchema>;
export type ListBouncesQuery = v.InferInput<typeof ListBouncesQuerySchema>;
export type DeleteBouncesCommand = v.InferInput<typeof DeleteBouncesCommandSchema>;

export type BounceSummary = {
	id: number;
	type: BounceType;
	source: string;
	createdAt: string;
	email: string;
	/** Campaign display context is part of bounce triage; provider IDs stay private. */
	campaignName: string | null;
};

export type BouncePage = {
	items: BounceSummary[];
	total: number;
	page: number;
	requestedPage: number;
	pageSize: typeof BOUNCE_PAGE_SIZE;
};
