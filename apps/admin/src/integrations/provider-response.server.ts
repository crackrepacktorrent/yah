import 'server-only';
import * as v from 'valibot';
import { providerContractError } from '~/integrations/provider-contract.server';

/** Keep provider payload validation private while standardizing its failure boundary. */
export function createProviderResponseParser(provider: string) {
	return function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		schema: TSchema,
		input: unknown,
		endpoint: string,
	): v.InferOutput<TSchema> {
		const result = v.safeParse(schema, input);
		if (!result.success) throw providerContractError(provider, `${endpoint} response`, result.issues);
		return result.output;
	};
}
