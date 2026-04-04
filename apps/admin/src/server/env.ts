function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

export const env = {
	DATABASE_URL: required('DATABASE_URL'),
	BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
	BETTER_AUTH_URL: required('BETTER_AUTH_URL'),

	LISTMONK_URL: required('LISTMONK_URL'),
	LISTMONK_API_TOKEN: required('LISTMONK_API_TOKEN'),
	LISTMONK_INVITATION_TEMPLATE_ID: Number(required('LISTMONK_INVITATION_TEMPLATE_ID')),
	LISTMONK_PASSWORD_RESET_TEMPLATE_ID: Number(required('LISTMONK_PASSWORD_RESET_TEMPLATE_ID')),

	SHLINK_URL: required('SHLINK_URL'),
	SHLINK_API_KEY: required('SHLINK_API_KEY'),

	UMAMI_URL: required('UMAMI_URL'),
	UMAMI_USERNAME: required('UMAMI_USERNAME'),
	UMAMI_PASSWORD: required('UMAMI_PASSWORD'),
	UMAMI_WEBSITE_ID: required('UMAMI_WEBSITE_ID'),
} as const;
