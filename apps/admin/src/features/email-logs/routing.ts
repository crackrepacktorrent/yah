import { EMAIL_LOG_PAGE_SIZE, type EmailLogPageQuery } from './contracts';

export function decodeEmailLogLocation(query: Record<string, unknown>): EmailLogPageQuery {
	const raw = Array.isArray(query['page']) ? query['page'][0] : query['page'];
	if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return { page: 1 };
	const page = Number(raw);
	return { page: Number.isSafeInteger(page) && page <= 10_000 ? page : 1 };
}

export function emailLogHref(page: number): string {
	return page <= 1 ? '/emails/logs' : `/emails/logs?page=${page}`;
}

export function emailLogPageCount(total: number): number {
	return Math.max(1, Math.ceil(total / EMAIL_LOG_PAGE_SIZE));
}
