import * as v from 'valibot';

export const EMAIL_LOG_PAGE_SIZE = 200;
export const EmailLogPageQuerySchema = v.strictObject({
	page: v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid log page.'), v.maxValue(10_000)),
});

export type EmailLogPageQuery = v.InferInput<typeof EmailLogPageQuerySchema>;
export type EmailLogPage = {
	lines: string[];
	total: number;
	page: number;
	requestedPage: number;
	pageSize: number;
};
