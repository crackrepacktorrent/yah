// Module augmentation to add `prop:indeterminate` to Solid JSX types.
// The Solid Babel transform handles `prop:*` attributes at runtime (setting DOM
// properties directly), but the TypeScript definitions don't include them.
// This file must be a module (export {}) so TS treats it as an augmentation,
// not a replacement of the 'solid-js' declaration.
export {};

declare module 'solid-js' {
	namespace JSX {
		interface InputHTMLAttributes<T> {
			'prop:indeterminate'?: boolean;
		}
	}
}
