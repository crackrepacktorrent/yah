import { auth } from '$lib/server/auth';
import { query, command, form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import type { StandardSchemaV1 } from '@standard-schema/spec';

type Permissions = Record<string, string[]>;

export async function getSessionOrThrow() {
	const event = getRequestEvent();
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	if (!session) {
		error(401, 'Not authenticated');
	}

	return session;
}

export async function enforcePermissions(permissions: Permissions) {
	const event = getRequestEvent();
	const result = await auth.api.hasPermission({
		headers: event.request.headers,
		body: { permissions },
	});

	if (!result.success) {
		error(403, result.error || 'Insufficient permissions');
	}
}

// ─── Protected query ─────────────────────────────────────────────────────────

export function protectedQuery<Output>(
	permissions: Permissions,
	fn: () => Output,
): ReturnType<typeof query<Output>>;

export function protectedQuery<Schema extends StandardSchemaV1, Output>(
	permissions: Permissions,
	schema: Schema,
	fn: (arg: StandardSchemaV1.InferOutput<Schema>) => Output,
): ReturnType<typeof query<Schema, Output>>;

export function protectedQuery(permissions: Permissions, schemaOrFn: any, maybeFn?: any) {
	if (typeof schemaOrFn === 'function') {
		return query(async () => {
			await enforcePermissions(permissions);
			return schemaOrFn();
		});
	}
	return query(schemaOrFn, async (arg: any) => {
		await enforcePermissions(permissions);
		return maybeFn(arg);
	});
}

// ─── Protected command ───────────────────────────────────────────────────────

export function protectedCommand<Output>(
	permissions: Permissions,
	fn: () => Output,
): ReturnType<typeof command<Output>>;

export function protectedCommand<Schema extends StandardSchemaV1, Output>(
	permissions: Permissions,
	schema: Schema,
	fn: (arg: StandardSchemaV1.InferOutput<Schema>) => Output,
): ReturnType<typeof command<Schema, Output>>;

export function protectedCommand(permissions: Permissions, schemaOrFn: any, maybeFn?: any) {
	if (typeof schemaOrFn === 'function') {
		return command(async () => {
			await enforcePermissions(permissions);
			return schemaOrFn();
		});
	}
	return command(schemaOrFn, async (arg: any) => {
		await enforcePermissions(permissions);
		return maybeFn(arg);
	});
}

// ─── Protected form ──────────────────────────────────────────────────────────

// Wraps form() with permission check. Uses `typeof form` to preserve full type inference.
export function protectedForm<S extends Parameters<typeof form>[0], F extends Parameters<typeof form>[1]>(
	permissions: Permissions,
	schema: S,
	fn: F,
): ReturnType<typeof form> {
	return form(schema as Parameters<typeof form>[0], async (data: Record<string, unknown>, issue: Record<string | number, unknown>) => {
		await enforcePermissions(permissions);
		return (fn as Function)(data, issue);
	}) as ReturnType<typeof form>;
}
