function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

function requiredHttpOrigin(name: string): string {
	const value = required(name);
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error(`Invalid URL in env var: ${name}`);
	}

	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error(`Env var ${name} must be an HTTP(S) origin without credentials`);
	}

	return url.origin;
}

function requiredPositiveInteger(name: string): number {
	const value = Number(required(name));
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new Error(`Env var ${name} must be a positive integer`);
	}
	return value;
}

function requiredSecret(name: string, minimumLength = 32): string {
	const value = required(name);
	if (value.length < minimumLength) throw new Error(`Env var ${name} must be at least ${minimumLength} characters`);
	return value;
}

export const env = {
	DATABASE_URL: required('DATABASE_URL'),
	BETTER_AUTH_SECRET: requiredSecret('BETTER_AUTH_SECRET'),
	BETTER_AUTH_URL: requiredHttpOrigin('BETTER_AUTH_URL'),
	PUBLIC_SITE_URL: requiredHttpOrigin('PUBLIC_SITE_URL'),

	LISTMONK_URL: requiredHttpOrigin('LISTMONK_URL'),
	LISTMONK_API_TOKEN: required('LISTMONK_API_TOKEN'),
	LISTMONK_ADMIN_ACCESS_TEMPLATE_ID: requiredPositiveInteger('LISTMONK_ADMIN_ACCESS_TEMPLATE_ID'),
	LISTMONK_INVITATION_TEMPLATE_ID: requiredPositiveInteger('LISTMONK_INVITATION_TEMPLATE_ID'),
	LISTMONK_PASSWORD_RESET_TEMPLATE_ID: requiredPositiveInteger('LISTMONK_PASSWORD_RESET_TEMPLATE_ID'),

	SHLINK_URL: requiredHttpOrigin('SHLINK_URL'),
	SHLINK_API_KEY: required('SHLINK_API_KEY'),

	UMAMI_URL: requiredHttpOrigin('UMAMI_URL'),
	UMAMI_USERNAME: required('UMAMI_USERNAME'),
	UMAMI_PASSWORD: required('UMAMI_PASSWORD'),
	UMAMI_WEBSITE_ID: required('UMAMI_WEBSITE_ID'),
} as const;
