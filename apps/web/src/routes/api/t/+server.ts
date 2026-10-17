import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import { collectAnalytics } from '$lib/server/analytics/collector.server';

export const POST: RequestHandler = ({ request }) => collectAnalytics(request, env.UMAMI_COLLECT_URL);
export const OPTIONS = POST;
