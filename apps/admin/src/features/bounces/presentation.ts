import type { BounceType } from './contracts';

export function bounceTypeLabel(type: BounceType): string {
	if (type === 'hard') return 'Hard';
	if (type === 'soft') return 'Soft';
	return 'Complaint';
}
