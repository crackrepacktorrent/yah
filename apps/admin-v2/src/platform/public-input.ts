import * as v from 'valibot';
import { createPublicError } from './errors';

/** Validate untrusted public input and surface only schema-owned issue text. */
export function createPublicInputParser(fallback: string) {
	return function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		schema: TSchema,
		input: unknown,
	): v.InferOutput<TSchema> {
		const result = v.safeParse(schema, input);
		if (!result.success) throw createPublicError(result.issues[0]?.message ?? fallback, 400);
		return result.output;
	};
}
