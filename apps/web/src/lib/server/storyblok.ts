import { env } from '$env/dynamic/private';
import { getStoryblokClient, refreshPublishedCacheVersion } from './storyblok-client';
import { validateStoryblokEditorRequest } from './storyblok-preview';

export type StoryblokRequestContext = {
	api: ReturnType<typeof getStoryblokClient>;
	version: 'draft' | 'published';
	isDraft: boolean;
	fromRelease?: string;
};

export function getStoryblokErrorStatus(reason: unknown): number | undefined {
	if (typeof reason !== 'object' || reason === null || !('status' in reason)) return undefined;
	const status = (reason as { status?: unknown }).status;
	return typeof status === 'number' ? status : undefined;
}

export function getStoryblokRequestOptions(
	context: StoryblokRequestContext,
	language: string
) {
	return {
		version: context.version,
		language,
		fallback_lang: 'en',
		...(context.fromRelease ? { from_release: context.fromRelease } : {})
	};
}

function configuredPreviewTokens(): string[] {
	const configured =
		env.STORYBLOK_PREVIEW_TOKENS ||
		env.STORYBLOK_PREVIEW_TOKEN ||
		// Runtime-only migration fallback for existing VPS env files. There must
		// never be an import.meta.env/client-bundled preview-token fallback.
		env.VITE_STORYBLOK_PREVIEW_TOKEN ||
		'';

	return configured.split(',').map((token) => token.trim()).filter(Boolean);
}

function configuredPublicToken(): string {
	const token = env.STORYBLOK_PUBLIC_TOKEN || import.meta.env.VITE_STORYBLOK_PUBLIC_TOKEN || '';
	if (!token) throw new Error('STORYBLOK_PUBLIC_TOKEN must be set');
	return token;
}

export function isAuthorizedStoryblokEditorRequest(url: URL): boolean {
	return validateStoryblokEditorRequest(url, configuredPreviewTokens()) !== null;
}

/** Choose published or draft access for this exact request. */
export function getStoryblokRequestContext(url: URL): StoryblokRequestContext {
	const previewToken = validateStoryblokEditorRequest(url, configuredPreviewTokens());
	const release = url.searchParams.get('_storyblok_release');
	const fromRelease = previewToken && release && /^\d+$/.test(release) && release !== '0'
		? release
		: undefined;

	if (previewToken) {
		return {
			api: getStoryblokClient(previewToken),
			version: 'draft',
			isDraft: true,
			fromRelease
		};
	}

	const api = getPublishedStoryblokApi();

	return {
		api,
		version: 'published',
		isDraft: false
	};
}

export function getPublishedStoryblokApi() {
	const api = getStoryblokClient(configuredPublicToken());
	refreshPublishedCacheVersion(api);
	return api;
}
