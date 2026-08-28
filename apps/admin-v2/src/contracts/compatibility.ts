import * as v from 'valibot';

export const compatibilityCommandSchema = v.strictObject({
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
});

export type CompatibilityCommand = v.InferOutput<typeof compatibilityCommandSchema>;

export function parseCompatibilityCommand(input: unknown): CompatibilityCommand {
	return v.parse(compatibilityCommandSchema, input);
}
