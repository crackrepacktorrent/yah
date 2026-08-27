export function decodeEmailTemplateRouteId(segment: string): number {
	if (!/^[1-9]\d*$/.test(segment)) return 0;
	const id = Number(segment);
	return Number.isSafeInteger(id) ? id : 0;
}

export function emailTemplateHref(id: number): string {
	return `/emails/templates/${id}`;
}
