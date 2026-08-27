import { action, query } from '@solidjs/router';
import { env } from 'virtual:env/server';
import { parseCompatibilityCommand } from '~/contracts/compatibility';
import { createPublicError } from '~/platform/errors';

function requireCompatibilityLab(): void {
	if (env.ADMIN_V2_RUNTIME !== 'compatibility-lab') throw createPublicError('Not found.', 404);
}

export const getCompatibilitySnapshot = query(async () => {
	'use server';
	requireCompatibilityLab();

	return {
		rendering: 'csr' as const,
		router: 'solid-router-2' as const,
		runtime: env.ADMIN_V2_RUNTIME,
		serverFunctions: true as const,
	};
}, 'compatibility-snapshot');

export const runCompatibilityCheck = action(async (formData: FormData) => {
	'use server';
	requireCompatibilityLab();

	const command = parseCompatibilityCommand({ label: formData.get('label') });
	return { accepted: true as const, label: command.label };
});
