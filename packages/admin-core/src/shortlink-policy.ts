export const PRINTED_QR_SHORT_CODES = [
	'campus-training',
	'donate',
	'join',
	'sign-in',
	'signup',
	'training',
	'whatsapp',
] as const;

const printedQrShortCodes = new Set<string>(PRINTED_QR_SHORT_CODES);

/** Case-sensitive Shlink slugs whose permanent URLs appear in printed materials. */
export function isPrintedQrShortCode(shortCode: string): boolean {
	return printedQrShortCodes.has(shortCode);
}
