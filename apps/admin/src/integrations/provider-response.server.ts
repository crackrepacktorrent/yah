import 'server-only';
import * as v from 'valibot';

/** Keep provider payload validation private while standardizing its failure boundary. */
export function createProviderResponseParser(provider: string) {
	return function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		schema: TSchema,
		input: unknown,
		endpoint: string,
	): v.InferOutput<TSchema> {
		const result = v.safeParse(schema, input);
		if (!result.success) throw new Error(`${provider} returned an invalid ${endpoint} response.`);
		return result.output;
	};
}
