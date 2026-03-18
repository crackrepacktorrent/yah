import * as v from 'valibot';

type FormErrors<T> = { [K in keyof T]?: string };

// Lightweight reactive form state with Valibot validation.
export function useForm<T extends Record<string, unknown>>(
	initial: T,
	schema: v.GenericSchema<any, any>,
) {
	let values = $state<T>({ ...initial });
	let touched = $state<Partial<Record<keyof T, boolean>>>({});
	let showAll = $state(false);

	// Single derived validation — re-runs automatically when values change
	let validation = $derived.by(() => {
		const result = v.safeParse(schema, values);
		if (result.success) return {} as FormErrors<T>;
		const errs: FormErrors<T> = {};
		for (const issue of result.issues) {
			const key = issue.path?.[0]?.key as keyof T | undefined;
			if (key && !errs[key]) {
				errs[key] = issue.message;
			}
		}
		return errs;
	});

	/** Validate all fields. Returns true if valid. Shows all errors. */
	function validate(): boolean {
		showAll = true;
		return Object.keys(validation).length === 0;
	}

	/** Mark a field as touched (call on blur). */
	function touch(field: keyof T) {
		touched[field] = true;
	}

	/** Reset form to initial values and clear errors. */
	function reset(newValues?: Partial<T>) {
		Object.assign(values, initial, newValues);
		touched = {};
		showAll = false;
	}

	/** Get error for a field — only shows if field is touched or validate() was called. */
	function fieldError(field: keyof T): string | undefined {
		if (!showAll && !touched[field]) return undefined;
		return validation[field];
	}

	return {
		get values() { return values; },
		get errors() { return validation; },
		validate,
		touch,
		reset,
		fieldError,
	};
}
