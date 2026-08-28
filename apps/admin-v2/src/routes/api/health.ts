import type { APIHandler } from 'filesystem-routing/api';
import { env } from 'virtual:env/server';

async function readiness(head = false): Promise<Response> {
	if (env.ADMIN_V2_RUNTIME === 'production') {
		try {
			const { pool } = await import('~/platform/auth/production-server');
			await pool.query('SELECT 1');
		} catch (error) {
			console.error('[admin-v2:health] Database readiness check failed', error);
			return head ? new Response(null, { status: 503 }) : Response.json({ status: 'unavailable' }, { status: 503 });
		}
	}

	return head ? new Response(null, { status: 200 }) : Response.json({ app: 'yah-admin-v2', status: 'ok' });
}

export const GET: APIHandler = () => readiness();
export const HEAD: APIHandler = () => readiness(true);
