import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	BounceSubscriberIdSchema,
	DeleteBouncesCommandSchema,
	ListBouncesQuerySchema,
	type BouncePage,
	type BounceSummary,
	type DeleteBouncesCommand,
	type ListBouncesQuery,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type BounceManager = {
	list(input: { page: number }): Promise<BouncePage>;
	listForSubscriber(subscriberId: number): Promise<BounceSummary[]>;
	delete(ids: readonly number[]): Promise<void>;
	clearAll(): Promise<void>;
	clearSubscriber(subscriberId: number): Promise<void>;
};

export type BounceServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: BounceManager;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid bounce data.', 400);
	return result.output;
}

async function authorize(
	headers: Headers,
	capability: 'view' | 'delete' | 'clear-all',
	dependencies: BounceServiceDependencies,
): Promise<void> {
	await dependencies.enforcePermissions(headers, { bounce: [capability] });
}

export async function listAuthorizedBounces(
	input: ListBouncesQuery,
	headers: Headers,
	dependencies: BounceServiceDependencies,
): Promise<BouncePage> {
	const query = parse(ListBouncesQuerySchema, input);
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.list(query);
}

export async function listAuthorizedSubscriberBounces(
	input: unknown,
	headers: Headers,
	dependencies: BounceServiceDependencies,
): Promise<BounceSummary[]> {
	const subscriberId = parse(BounceSubscriberIdSchema, input);
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.listForSubscriber(subscriberId);
}

export async function deleteAuthorizedBounces(
	input: DeleteBouncesCommand,
	headers: Headers,
	dependencies: BounceServiceDependencies,
): Promise<void> {
	const command = parse(DeleteBouncesCommandSchema, input);
	await authorize(headers, 'delete', dependencies);
	await dependencies.manager.delete(command.ids);
}

export async function clearAuthorizedBounces(
	headers: Headers,
	dependencies: BounceServiceDependencies,
): Promise<void> {
	await authorize(headers, 'clear-all', dependencies);
	await dependencies.manager.clearAll();
}

export async function clearAuthorizedSubscriberBounces(
	input: unknown,
	headers: Headers,
	dependencies: BounceServiceDependencies,
): Promise<void> {
	const subscriberId = parse(BounceSubscriberIdSchema, input);
	await authorize(headers, 'delete', dependencies);
	await dependencies.manager.clearSubscriber(subscriberId);
}
