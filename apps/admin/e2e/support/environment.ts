const LOCAL_ADMIN_URL = 'http://127.0.0.1:3002';

type Environment = Record<string, string | undefined>;

export type AuthCredentials = {
	email: string;
	password: string;
};

export type AuthEnvironment = { credentials: AuthCredentials; skipReason: null } | { credentials: null; skipReason: string };

function parseHttpOrigin(name: string, rawValue: string): string {
	let url: URL;
	try {
		url = new URL(rawValue);
	} catch {
		throw new Error(`${name} must be an absolute HTTP(S) URL`);
	}

	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error(`${name} must be an HTTP(S) origin without embedded credentials`);
	}
	if (url.pathname !== '/' || url.search || url.hash) {
		throw new Error(`${name} must be an origin without a path, query, or fragment`);
	}

	return url.origin;
}

export function getCurrentBaseUrl(environment: Environment = process.env): string {
	return parseHttpOrigin('ADMIN_E2E_BASE_URL', environment['ADMIN_E2E_BASE_URL'] ?? LOCAL_ADMIN_URL);
}

export function getV2BaseUrl(environment: Environment = process.env): string | null {
	const value = environment['ADMIN_V2_E2E_BASE_URL']?.trim();
	return value ? parseHttpOrigin('ADMIN_V2_E2E_BASE_URL', value) : null;
}

export function getAuthEnvironment(environment: Environment = process.env): AuthEnvironment {
	const email = environment['ADMIN_E2E_EMAIL']?.trim() ?? '';
	const password = environment['ADMIN_E2E_PASSWORD'] ?? '';

	if (!email && !password) {
		return {
			credentials: null,
			skipReason: 'Authenticated parity is disabled: set both ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD.',
		};
	}
	if (!email || !password) {
		throw new Error('Authenticated parity configuration is incomplete: set both ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD.');
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new Error('ADMIN_E2E_EMAIL must be a valid email address.');
	}

	return {
		credentials: { email, password },
		skipReason: null,
	};
}
