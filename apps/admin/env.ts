import * as v from 'valibot';

export default {
	server: {
		ADMIN_RUNTIME: v.optional(v.picklist(['production', 'platform-disabled']), 'platform-disabled'),
		DATABASE_URL: v.optional(v.string()),
		BETTER_AUTH_SECRET: v.optional(v.string()),
		BETTER_AUTH_URL: v.optional(v.string()),
		PUBLIC_SITE_URL: v.optional(v.string()),
		LISTMONK_URL: v.optional(v.string()),
		LISTMONK_API_TOKEN: v.optional(v.string()),
		LISTMONK_ADMIN_ACCESS_TEMPLATE_ID: v.optional(v.string()),
		LISTMONK_INVITATION_TEMPLATE_ID: v.optional(v.string()),
		LISTMONK_PASSWORD_RESET_TEMPLATE_ID: v.optional(v.string()),
		SHLINK_URL: v.optional(v.string()),
		SHLINK_API_KEY: v.optional(v.string()),
		UMAMI_URL: v.optional(v.string()),
		UMAMI_USERNAME: v.optional(v.string()),
		UMAMI_PASSWORD: v.optional(v.string()),
		UMAMI_WEBSITE_ID: v.optional(v.string()),
	},
	client: {
		VITE_ADMIN_TITLE: v.optional(v.pipe(v.string(), v.minLength(1)), 'YAH Admin'),
	},
};
