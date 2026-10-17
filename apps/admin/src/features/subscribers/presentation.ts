import type { SubscriberStatus } from './contracts';

export function subscriberStatusLabel(status: SubscriberStatus): string {
	if (status === 'enabled') return 'Enabled';
	if (status === 'disabled') return 'Disabled';
	return 'Blocklisted';
}

export function safeActivityLinkHref(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}
