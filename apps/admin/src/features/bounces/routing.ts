import { MAX_BOUNCE_PAGE } from './contracts';

export function decodeBounceListLocation(query: Record<string, string | string[] | undefined>): { page: number } {
	const rawPage = typeof query['page'] === 'string' ? query['page'] : '';
	const parsedPage = Number(rawPage);
	return {
		page: /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(parsedPage) && parsedPage <= MAX_BOUNCE_PAGE
			? parsedPage
			: 1,
	};
}

export function bounceListHref(input: { page?: number }): string {
	const page = input.page ?? 1;
	return page > 1 ? `/emails/bounces?page=${page}` : '/emails/bounces';
}
