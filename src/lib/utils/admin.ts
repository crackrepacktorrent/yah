/** Format seconds as "Xm Ys" or "Xs". */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}m ${s}s`;
}

/** Map subscriber status to Badge variant. */
export function subscriberStatusVariant(status: string): 'success' | 'error' | 'default' {
	if (status === 'enabled') return 'success';
	if (status === 'blocklisted') return 'error';
	return 'default';
}

/** Map campaign status to Badge variant. */
export function campaignStatusVariant(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
	switch (status) {
		case 'draft': return 'default';
		case 'running': return 'success';
		case 'paused': return 'warning';
		case 'finished': return 'info';
		case 'cancelled': return 'error';
		case 'scheduled': return 'warning';
		default: return 'default';
	}
}
