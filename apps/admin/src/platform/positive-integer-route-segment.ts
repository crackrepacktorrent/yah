export function decodePositiveIntegerRouteSegment(segment: string): number {
	if (!/^[1-9]\d*$/.test(segment)) return 0;
	const value = Number(segment);
	return Number.isSafeInteger(value) ? value : 0;
}
