import { pool } from '~/server/auth';

export async function GET(): Promise<Response> {
	try {
		await pool.query('SELECT 1');
		return Response.json({ status: 'ok' });
	} catch (error) {
		console.error('[health] Database readiness check failed', error);
		return Response.json({ status: 'unavailable' }, { status: 503 });
	}
}
