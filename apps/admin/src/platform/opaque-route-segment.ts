const OPAQUE_SEGMENT_PREFIX = '~h';
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Router 2 applies decodeURI to pathnames, which leaves some percent escapes
 * encoded and decodes others. A versioned lowercase-hex segment keeps opaque
 * provider/database identifiers independent of that mixed decoding behavior.
 */
export function encodeOpaqueRouteSegment(value: string): string {
	const encoded = Array.from(utf8Encoder.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${OPAQUE_SEGMENT_PREFIX}${encoded}`;
}

export function decodeOpaqueRouteSegment(segment: string): string {
	if (!segment.startsWith(OPAQUE_SEGMENT_PREFIX)) return '';
	const encoded = segment.slice(OPAQUE_SEGMENT_PREFIX.length);
	if (encoded.length === 0 || encoded.length % 2 !== 0 || !/^[0-9a-f]+$/.test(encoded)) return '';
	const bytes = new Uint8Array(encoded.length / 2);
	for (let index = 0; index < encoded.length; index += 2) bytes[index / 2] = Number.parseInt(encoded.slice(index, index + 2), 16);
	try {
		return utf8Decoder.decode(bytes);
	} catch {
		return '';
	}
}
