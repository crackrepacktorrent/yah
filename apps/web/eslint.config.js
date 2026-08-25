import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		ignores: ['.svelte-kit/**', 'build/**', 'node_modules/**', 'static/pdfjs/**']
	},
	{
		...js.configs.recommended,
		files: ['src/**/*.ts'],
		linterOptions: {
			reportUnusedDisableDirectives: false
		},
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': tseslint
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'no-var': 'error',
			'prefer-const': 'error'
		}
	}
];
