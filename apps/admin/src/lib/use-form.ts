import { createMemo, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import * as v from 'valibot';

type SchemaOutput<S> = S extends v.BaseSchema<unknown, infer O, v.BaseIssue<unknown>> ? O : never;

type FormErrors<T> = Partial<Record<keyof T, string>>;
type FormTouched<T> = Partial<Record<keyof T, boolean>>;

/**
 * Lightweight SolidJS form helper backed by a valibot schema.
 *
 * Usage:
 *   const form = createForm(MySchema, { email: '', name: '' });
 *   <input {...form.field('email')} />
 *   <Show when={form.fieldError('email')}>{(e) => <p>{e()}</p>}</Show>
 *   <button onClick={form.handleSubmit(onValid)}>Submit</button>
 */
export function createForm<
	S extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	T extends SchemaOutput<S> & Record<string, unknown>,
>(schema: S, initial: T) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [values, setValues] = createStore<T>(structuredClone(initial) as any);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [touched, setTouched] = createStore<FormTouched<T>>({} as any);
	const [submitted, setSubmitted] = createSignal(false);

	const errors = createMemo<FormErrors<T>>(() => {
		const result = v.safeParse(schema, values);
		if (result.success) return {};
		const map: FormErrors<T> = {};
		for (const issue of result.issues) {
			const key = issue.path?.[0]?.key as keyof T | undefined;
			if (key != null && !(key in map)) {
				map[key] = issue.message;
			}
		}
		return map;
	});

	/** Returns the error string for a field, but only if touched or form was submitted. */
	function fieldError(name: keyof T): string | undefined {
		if (!submitted() && !touched[name]) return undefined;
		return errors()[name];
	}

	/** Returns props to spread onto an <input> or <textarea> for a given field. */
	function field(name: keyof T & string) {
		return {
			name,
			get value() { return values[name] as string; },
			onInput(e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(setValues as any)(name, e.currentTarget.value);
			},
			onBlur() {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(setTouched as any)(name, true);
			},
		};
	}

	/** Sets a field value by name — use this for non-string fields (booleans, arrays, etc). */
	function setValue<K extends keyof T & string>(name: K, value: T[K]): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(setValues as any)(name, value);
	}

	/** Wraps a submit handler — validates first, marks all errored fields touched on failure. */
	function handleSubmit(onValid: (values: T) => void | Promise<void>) {
		return async (e?: Event) => {
			e?.preventDefault();
			setSubmitted(true);
			const result = v.safeParse(schema, values);
			if (!result.success) {
				for (const issue of result.issues) {
					const key = issue.path?.[0]?.key as keyof T | undefined;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					if (key != null) (setTouched as any)(key, true);
				}
				return;
			}
			await onValid(result.output as T);
		};
	}

	/** Resets values, touched, and submitted state back to initial. */
	function reset() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(setValues as any)(reconcile(structuredClone(initial)));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(setTouched as any)(reconcile({}));
		setSubmitted(false);
	}

	const isValid = createMemo(() => v.safeParse(schema, values).success);

	return { values, setValues, errors, fieldError, field, setValue, handleSubmit, reset, isValid, submitted };
}
