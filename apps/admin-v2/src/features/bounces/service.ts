import 'server-only';
import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicInputParser } from '~/platform/public-input';
import {
	BounceSubscriberIdSchema,
	DeleteBouncesCommandSchema,
	ListBouncesQuerySchema,
	type BouncePage,
	type BounceSummary,
	type DeleteBouncesCommand,
	type ListBouncesQuery,
} from './contracts';

export type BounceManager = {
	list(input: { page: number }): Promise<BouncePage>;
	listForSubscriber(subscriberId: number): Promise<BounceSummary[]>;
	delete(ids: readonly number[]): Promise<void>;
	clearAll(): Promise<void>;
	clearSubscriber(subscriberId: number): Promise<void>;
};

export type BounceServiceDependencies = {
	authorization: AuthorizationContext;
	manager: BounceManager;
};
const parse = createPublicInputParser('Invalid bounce data.');

async function authorize(
	capability: 'view' | 'delete' | 'clear-all',
	dependencies: BounceServiceDependencies,
): Promise<void> {
	await dependencies.authorization.requirePermissions({ bounce: [capability] });
}

export async function listAuthorizedBounces(
	input: ListBouncesQuery,
	dependencies: BounceServiceDependencies,
): Promise<BouncePage> {
	const query = parse(ListBouncesQuerySchema, input);
	await authorize('view', dependencies);
	return dependencies.manager.list(query);
}

export async function listAuthorizedSubscriberBounces(
	input: unknown,
	dependencies: BounceServiceDependencies,
): Promise<BounceSummary[]> {
	const subscriberId = parse(BounceSubscriberIdSchema, input);
	await authorize('view', dependencies);
	return dependencies.manager.listForSubscriber(subscriberId);
}

export async function deleteAuthorizedBounces(
	input: DeleteBouncesCommand,
	dependencies: BounceServiceDependencies,
): Promise<void> {
	const command = parse(DeleteBouncesCommandSchema, input);
	await authorize('delete', dependencies);
	await dependencies.manager.delete(command.ids);
}

export async function clearAuthorizedBounces(
	dependencies: BounceServiceDependencies,
): Promise<void> {
	await authorize('clear-all', dependencies);
	await dependencies.manager.clearAll();
}

export async function clearAuthorizedSubscriberBounces(
	input: unknown,
	dependencies: BounceServiceDependencies,
): Promise<void> {
	const subscriberId = parse(BounceSubscriberIdSchema, input);
	await authorize('delete', dependencies);
	await dependencies.manager.clearSubscriber(subscriberId);
}
