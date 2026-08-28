import * as v from 'valibot';
export { idListSchema, nonEmptyStringSchema, positiveIntegerSchema } from '~/lib/schemas';
import { HttpError } from './http-errors';

export function parseInput<const TSchema extends v.GenericSchema>(schema: TSchema, input: unknown): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input, { abortEarly: true });
	if (result.success) return result.output;

	throw new HttpError(`Invalid request: ${result.issues[0]?.message ?? 'Malformed input.'}`, 400);
}
