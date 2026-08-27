export function decodeMailingListRouteId(segment: string): number {
	if (!/^[1-9]\d*$/.test(segment)) return 0;
	const id = Number(segment);
	return Number.isSafeInteger(id) ? id : 0;
}

export function mailingListHref(id: number): string {
	return `/emails/lists/${id}`;
}
