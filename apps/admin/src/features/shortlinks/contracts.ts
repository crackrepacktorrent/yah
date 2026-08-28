import * as v from 'valibot';

const nonBlankText = v.pipe(v.string(), v.trim(), v.minLength(1));
const httpUrl = v.pipe(
	v.string(),
	v.trim(),
	v.url('Enter a valid URL.'),
	v.check((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP and HTTPS URLs are supported.'),
	v.maxLength(4_096, 'URL is too long.'),
);
const optionalText = v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1_000)));
const shortCode = v.pipe(
	nonBlankText,
	v.maxLength(255),
	v.regex(/^[^/?#\s,]+$/, 'Short code contains unsupported characters.'),
);
const tag = v.pipe(nonBlankText, v.maxLength(100));
const tags = v.pipe(
	v.array(tag),
	v.maxLength(100),
	v.transform((values) => [...new Set(values)]),
);
const maxVisits = v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)));
const optionalDateTime = v.optional(
	v.pipe(
		v.string(),
		v.maxLength(64),
		v.check((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid expiry date.'),
		v.regex(/(?:Z|[+-]\d{2}:\d{2})$/, 'Expiry date must include a UTC offset.'),
	),
);

export const ShortCodeSchema = shortCode;
export const ShortlinkCapabilitySchema = v.picklist(['view', 'create', 'edit', 'delete'] as const);
export const CreateShortlinkCommandSchema = v.strictObject({
	longUrl: httpUrl,
	customSlug: v.optional(shortCode),
	title: optionalText,
	tags,
	maxVisits,
	validUntil: optionalDateTime,
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
});
export const EditShortlinkCommandSchema = v.strictObject({
	shortCode,
	longUrl: httpUrl,
	title: optionalText,
	tags,
	maxVisits,
	validUntil: optionalDateTime,
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
});

export type ShortlinkCapability = v.InferOutput<typeof ShortlinkCapabilitySchema>;
export type CreateShortlinkCommand = v.InferInput<typeof CreateShortlinkCommandSchema>;
export type EditShortlinkCommand = v.InferInput<typeof EditShortlinkCommandSchema>;

export type VisitSummary = {
	total: number;
	nonBots: number;
	bots: number;
};

export type Shortlink = {
	shortCode: string;
	shortUrl: string;
	longUrl: string;
	dateCreated: string;
	title: string | null;
	tags: string[];
	crawlable: boolean;
	forwardQuery: boolean;
	visits: VisitSummary;
	maxVisits: number | null;
	validUntil: string | null;
};

export type ShortlinkVisit = {
	referer: string;
	date: string;
	userAgent: string;
	location: {
		city: string;
		countryCode: string;
		country: string;
	} | null;
};

export type ShortlinkDetail = {
	shortlink: Shortlink;
	recentVisits: ShortlinkVisit[];
	totalVisits: number;
};

export type EditableShortlink = Pick<
	Shortlink,
	'shortCode' | 'longUrl' | 'title' | 'tags' | 'crawlable' | 'forwardQuery' | 'maxVisits' | 'validUntil'
>;

export type ShortlinkOverview = {
	totalShortlinks: number;
	visits: VisitSummary;
	recentShortlinks: Shortlink[];
};

/** A deliberately diagnostic-free provider failure safe to inspect at the feature boundary. */
export class ShortlinkProviderFailure extends Error {
	constructor(
		public readonly status: number,
		public readonly problemType: 'non-unique-slug' | null = null,
	) {
		super(`Shlink request failed with status ${status}.`);
		this.name = 'ShortlinkProviderFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isShortlinkProviderFailure(error: unknown): error is ShortlinkProviderFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'ShortlinkProviderFailure' &&
		'status' in error &&
		typeof error.status === 'number'
	);
}
