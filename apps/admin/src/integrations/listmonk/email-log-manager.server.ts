import 'server-only';
import * as v from 'valibot';
import { providerContractError } from '~/integrations/provider-contract.server';
import { EMAIL_LOG_PAGE_SIZE, type EmailLogPage } from '~/features/email-logs/contracts';
import type { EmailLogManager } from '~/features/email-logs/service';
import type { ProductionConfig } from '~/platform/config/production';
import { createListmonkTransport, type ListmonkRequest } from './transport.server';

const logResponseSchema = v.object({
	data: v.pipe(v.array(v.pipe(v.string(), v.maxLength(20_000))), v.maxLength(5_000)),
});
type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;

/** Remove common credential forms while retaining the surrounding diagnostic. */
export function redactEmailLogLine(line: string): string {
	return line
		.replace(/(authorization\s*[:=]\s*(?:bearer|token|basic)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/giu, '$1[REDACTED]')
		.replace(/(\b(?:[a-z0-9_-]*(?:password|passwd|pwd|secret|api[_-]?key|api[_-]?token|access[_-]?token))\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/giu, '$1[REDACTED]')
		.replace(/:\/\/([^\s/:@]+):([^\s/@]+)@/gu, '://$1:[REDACTED]@');
}

export function createListmonkEmailLogManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): EmailLogManager {
	const transport = createListmonkTransport(config, request);
	return {
		async list({ page }): Promise<EmailLogPage> {
			if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new Error('Select a valid log page.');
			const result = v.safeParse(logResponseSchema, await transport.json('/logs'));
			if (!result.success) throw providerContractError('Listmonk', 'log response', result.issues);
			const total = result.output.data.length;
			const pageCount = Math.max(1, Math.ceil(total / EMAIL_LOG_PAGE_SIZE));
			const resolvedPage = Math.min(page, pageCount);
			const end = total - (resolvedPage - 1) * EMAIL_LOG_PAGE_SIZE;
			const start = Math.max(0, end - EMAIL_LOG_PAGE_SIZE);
			return {
				lines: result.output.data.slice(start, end).map(redactEmailLogLine),
				total,
				page: resolvedPage,
				requestedPage: page,
				pageSize: EMAIL_LOG_PAGE_SIZE,
			};
		},
	};
}
