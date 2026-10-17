import type { EmailTemplateSummary } from './contracts';

export function emailTemplateKindLabel(kind: EmailTemplateSummary['kind']): string {
	if (kind === 'tx') return 'Transactional';
	if (kind === 'campaign') return 'Campaign / HTML';
	return 'Campaign / Visual';
}
