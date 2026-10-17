import type { MailingList } from './contracts';

export function mailingListKindLabel(kind: MailingList['kind']): string {
	if (kind === 'public') return 'Public';
	if (kind === 'private') return 'Private';
	return 'Temporary';
}

export function mailingListStatusLabel(status: MailingList['status']): string {
	return status === 'active' ? 'Active' : 'Archived';
}
