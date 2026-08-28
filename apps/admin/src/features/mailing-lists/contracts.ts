import * as v from 'valibot';

const mailingListId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid mailing list.'));
const name = v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a list name.'), v.maxLength(255, 'List name is too long.'));
const description = v.pipe(v.string(), v.trim(), v.maxLength(10_000, 'Description is too long.'));
const updatedAt = v.pipe(
	v.string(),
	v.maxLength(64),
	v.check((value) => !Number.isNaN(Date.parse(value)), 'The list version is invalid.'),
);

export const MailingListIdSchema = mailingListId;
export const MailingListKindSchema = v.picklist(['public', 'private', 'temporary'] as const);
export const AuthorableMailingListKindSchema = v.picklist(['public', 'private'] as const);
export const MailingListOptInSchema = v.picklist(['single', 'double'] as const);
export const MailingListStatusSchema = v.picklist(['active', 'archived'] as const);
export const MailingListCapabilitySchema = v.picklist(['view', 'create', 'edit', 'delete'] as const);
export const CreateMailingListCommandSchema = v.strictObject({
	name,
	kind: AuthorableMailingListKindSchema,
	optIn: MailingListOptInSchema,
	description,
});
export const UpdateMailingListCommandSchema = v.strictObject({
	id: mailingListId,
	expectedUpdatedAt: updatedAt,
	name,
	kind: AuthorableMailingListKindSchema,
	optIn: MailingListOptInSchema,
	status: MailingListStatusSchema,
	description,
});
export const SetMailingListVisibilityCommandSchema = v.strictObject({
	id: mailingListId,
	expectedUpdatedAt: updatedAt,
	public: v.boolean(),
});

export type MailingListKind = v.InferOutput<typeof MailingListKindSchema>;
export type AuthorableMailingListKind = v.InferOutput<typeof AuthorableMailingListKindSchema>;
export type MailingListOptIn = v.InferOutput<typeof MailingListOptInSchema>;
export type MailingListStatus = v.InferOutput<typeof MailingListStatusSchema>;
export type MailingListCapability = v.InferOutput<typeof MailingListCapabilitySchema>;
export type CreateMailingListCommand = v.InferInput<typeof CreateMailingListCommandSchema>;
export type UpdateMailingListCommand = v.InferInput<typeof UpdateMailingListCommandSchema>;
export type SetMailingListVisibilityCommand = v.InferInput<typeof SetMailingListVisibilityCommandSchema>;

export type MailingList = {
	id: number;
	uuid: string;
	name: string;
	kind: MailingListKind;
	optIn: MailingListOptIn;
	status: MailingListStatus;
	description: string;
	tags: string[];
	subscriberCount: number;
	unconfirmedCount: number;
	createdAt: string;
	updatedAt: string;
};

/** A diagnostic-free provider failure safe for feature services to classify. */
export class MailingListProviderFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk mailing-list request failed with status ${status}.`);
		this.name = 'MailingListProviderFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isMailingListProviderFailure(error: unknown): error is MailingListProviderFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'MailingListProviderFailure' &&
		'status' in error &&
		typeof error.status === 'number'
	);
}
