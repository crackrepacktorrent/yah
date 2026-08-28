import * as v from 'valibot';

export const positiveIntegerSchema = v.pipe(
	v.number('Expected a number.'),
	v.integer('Expected a whole number.'),
	v.minValue(1, 'Expected a positive number.'),
);

export const nonNegativeIntegerSchema = v.pipe(
	v.number('Expected a number.'),
	v.integer('Expected a whole number.'),
	v.minValue(0, 'Expected zero or a positive number.'),
);

export const nonEmptyStringSchema = v.pipe(v.string('Expected text.'), v.trim(), v.minLength(1, 'This value is required.'));

export const idListSchema = v.pipe(
	v.array(positiveIntegerSchema, 'Expected a list of IDs.'),
	v.minLength(1, 'Select at least one item.'),
	v.maxLength(500, 'At most 500 items can be changed at once.'),
	v.transform((ids) => [...new Set(ids)]),
);

export const emailSchema = v.pipe(
	v.string('Expected an email address.'),
	v.trim(),
	v.email('Enter a valid email address.'),
	v.maxLength(254, 'Email addresses must be at most 254 characters.'),
);

export const optionalTextSchema = v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1_000)));

export const dateTimeSchema = v.pipe(
	v.string('Expected a date.'),
	v.maxLength(64, 'Date value is too long.'),
	v.check((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date.'),
);

export const httpUrlSchema = v.pipe(
	v.string('Expected a URL.'),
	v.trim(),
	v.url('Enter a valid URL.'),
	v.check((value) => {
		const protocol = new URL(value).protocol;
		return protocol === 'http:' || protocol === 'https:';
	}, 'Only HTTP and HTTPS URLs are supported.'),
	v.maxLength(4_096, 'URL is too long.'),
);
