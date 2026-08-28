import { describe, expect, it } from 'vitest';
import { createListmonkV62SettingsFixture } from './listmonk-settings-document.fixture';
import { validateListmonkV62SettingsDocument } from './listmonk-settings-document.server';

type SettingsDocument = Record<string, unknown>;

function recordAt(document: SettingsDocument, key: string): Record<string, unknown> {
	const record = document[key];
	if (typeof record !== 'object' || record === null || Array.isArray(record)) throw new Error(`Expected ${key} to be a record.`);
	return record as Record<string, unknown>;
}

function collectionItemAt(document: SettingsDocument, key: string): Record<string, unknown> {
	const collection = document[key];
	if (!Array.isArray(collection) || typeof collection[0] !== 'object' || collection[0] === null) {
		throw new Error(`Expected ${key} to contain a record.`);
	}
	return collection[0] as Record<string, unknown>;
}

describe('complete Listmonk v6.2 settings document validation', () => {
	it('accepts the exact v6.2 shape, retains object identity, and preserves unknown future fields', () => {
		const document = createListmonkV62SettingsFixture();
		document['future.provider.setting'] = { enabled: true };
		collectionItemAt(document, 'smtp')['future_option'] = 'keep-me';

		const result = validateListmonkV62SettingsDocument(document);

		expect(result).toBe(document);
		expect(result['future.provider.setting']).toEqual({ enabled: true });
		expect(collectionItemAt(result, 'smtp')['future_option']).toBe('keep-me');
	});

	it('requires every non-omitempty top-level field and checks every top-level value type', () => {
		const complete = createListmonkV62SettingsFixture();
		const omitemptyKeys = new Set(['upload.s3.aws_secret_access_key']);
		for (const key of Object.keys(complete)) {
			const missing = structuredClone(complete);
			delete missing[key];
			if (omitemptyKeys.has(key)) expect(validateListmonkV62SettingsDocument(missing), `missing ${key}`).toBe(missing);
			else expect(() => validateListmonkV62SettingsDocument(missing), `missing ${key}`).toThrow(`at ${key}`);

			const wrongType = structuredClone(complete);
			const current = wrongType[key];
			wrongType[key] = typeof current === 'boolean' ? 'false'
				: typeof current === 'number' ? String(current)
					: typeof current === 'string' ? false
						: Array.isArray(current) ? {}
							: [];
			expect(() => validateListmonkV62SettingsDocument(wrongType), `wrong type for ${key}`).toThrow(`at ${key}`);
		}
	});

	it('matches Go omitempty behavior for empty collection and S3 secrets', () => {
		const document = createListmonkV62SettingsFixture();
		delete document['upload.s3.aws_secret_access_key'];
		delete collectionItemAt(document, 'smtp')['password'];
		delete collectionItemAt(document, 'messengers')['password'];
		delete collectionItemAt(document, 'bounce.mailboxes')['password'];

		expect(validateListmonkV62SettingsDocument(document)).toBe(document);
	});

	it('requires and type-checks every fixed nested provider, security, bounce, and maintenance field', () => {
		const shapes: Array<{
			label: string;
			parent: (document: SettingsDocument) => Record<string, unknown>;
			fields: string[];
			omitempty?: Set<string>;
		}> = [
			{
				label: 'SMTP',
				parent: (document) => collectionItemAt(document, 'smtp'),
				fields: [
					'name', 'uuid', 'enabled', 'host', 'hello_hostname', 'port', 'auth_protocol', 'username', 'password',
					'email_headers', 'max_conns', 'max_msg_retries', 'msg_retry_delay', 'idle_timeout', 'wait_timeout',
					'tls_type', 'tls_skip_verify', 'from_addresses',
				],
				omitempty: new Set(['password']),
			},
			{
				label: 'messenger',
				parent: (document) => collectionItemAt(document, 'messengers'),
				fields: ['uuid', 'enabled', 'name', 'root_url', 'username', 'password', 'max_conns', 'timeout', 'max_msg_retries'],
				omitempty: new Set(['password']),
			},
			{
				label: 'bounce mailbox',
				parent: (document) => collectionItemAt(document, 'bounce.mailboxes'),
				fields: [
					'uuid', 'enabled', 'type', 'host', 'port', 'auth_protocol', 'return_path', 'username', 'password',
					'tls_enabled', 'tls_skip_verify', 'scan_interval',
				],
				omitempty: new Set(['password']),
			},
			{
				label: 'ALTCHA',
				parent: (document) => recordAt(recordAt(document, 'security.captcha'), 'altcha'),
				fields: ['enabled', 'complexity'],
			},
			{
				label: 'hCaptcha',
				parent: (document) => recordAt(recordAt(document, 'security.captcha'), 'hcaptcha'),
				fields: ['enabled', 'key', 'secret'],
			},
			{
				label: 'OIDC',
				parent: (document) => recordAt(document, 'security.oidc'),
				fields: [
					'enabled', 'provider_url', 'provider_name', 'client_id', 'client_secret', 'auto_create_users',
					'default_user_role_id', 'default_list_role_id',
				],
			},
			{
				label: 'bounce action',
				parent: (document) => recordAt(recordAt(document, 'bounce.actions'), 'complaint'),
				fields: ['count', 'action'],
			},
			{
				label: 'Azure bounce provider',
				parent: (document) => recordAt(document, 'bounce.azure'),
				fields: ['enabled', 'shared_secret', 'shared_secret_header'],
			},
			{
				label: 'Postmark bounce provider',
				parent: (document) => recordAt(document, 'bounce.postmark'),
				fields: ['enabled', 'username', 'password'],
			},
			{
				label: 'Forward Email bounce provider',
				parent: (document) => recordAt(document, 'bounce.forwardemail'),
				fields: ['enabled', 'key'],
			},
			{
				label: 'Lettermint bounce provider',
				parent: (document) => recordAt(document, 'bounce.lettermint'),
				fields: ['enabled', 'key'],
			},
			{
				label: 'database maintenance',
				parent: (document) => recordAt(document, 'maintenance.db'),
				fields: ['vacuum', 'vacuum_cron_interval'],
			},
		];

		for (const { label, parent, fields, omitempty = new Set<string>() } of shapes) {
			for (const field of fields) {
				const missing = createListmonkV62SettingsFixture();
				delete parent(missing)[field];
				if (omitempty.has(field)) expect(validateListmonkV62SettingsDocument(missing), `${label}.${field} omitted`).toBe(missing);
				else expect(() => validateListmonkV62SettingsDocument(missing), `${label}.${field} missing`).toThrow('invalid complete v6.2 settings document');

				const wrongType = createListmonkV62SettingsFixture();
				const target = parent(wrongType);
				const current = target[field];
				target[field] = typeof current === 'boolean' ? 'false'
					: typeof current === 'number' ? String(current)
						: typeof current === 'string' ? false
							: Array.isArray(current) ? {}
								: [];
				expect(() => validateListmonkV62SettingsDocument(wrongType), `${label}.${field} wrong type`).toThrow('invalid complete v6.2 settings document');
			}
		}

		const wrongHeader = createListmonkV62SettingsFixture();
		collectionItemAt(wrongHeader, 'smtp')['email_headers'] = [{ 'X-Provider': false }];
		expect(() => validateListmonkV62SettingsDocument(wrongHeader)).toThrow('invalid complete v6.2 settings document');

		for (const invalidExportable of [['email'], ['profile', false]]) {
			const wrongListItem = createListmonkV62SettingsFixture();
			wrongListItem['privacy.exportable'] = invalidExportable;
			expect(() => validateListmonkV62SettingsDocument(wrongListItem)).toThrow('invalid complete v6.2 settings document');
		}
	});

	it('rejects invalid fixed enums and incomplete bounce policy before a full PUT', () => {
		const invalidSmtp = createListmonkV62SettingsFixture();
		collectionItemAt(invalidSmtp, 'smtp')['tls_type'] = 'SSL';
		expect(() => validateListmonkV62SettingsDocument(invalidSmtp)).toThrow('invalid complete v6.2 settings document');

		const invalidMailbox = createListmonkV62SettingsFixture();
		collectionItemAt(invalidMailbox, 'bounce.mailboxes')['auth_protocol'] = 'login';
		expect(() => validateListmonkV62SettingsDocument(invalidMailbox)).toThrow('invalid complete v6.2 settings document');

		const missingAction = createListmonkV62SettingsFixture();
		delete recordAt(missingAction, 'bounce.actions')['hard'];
		expect(() => validateListmonkV62SettingsDocument(missingAction)).toThrow('invalid complete v6.2 settings document');

		const invalidAction = createListmonkV62SettingsFixture();
		recordAt(recordAt(invalidAction, 'bounce.actions'), 'soft')['action'] = 'archive';
		expect(() => validateListmonkV62SettingsDocument(invalidAction)).toThrow('invalid complete v6.2 settings document');
	});

	it('accepts only empty or bullet-masked values in every field masked by Listmonk GET /settings', () => {
		const secretParents: Array<(document: SettingsDocument) => [Record<string, unknown>, string]> = [
			(document) => [collectionItemAt(document, 'smtp'), 'password'],
			(document) => [collectionItemAt(document, 'messengers'), 'password'],
			(document) => [collectionItemAt(document, 'bounce.mailboxes'), 'password'],
			(document) => [document, 'upload.s3.aws_secret_access_key'],
			(document) => [document, 'bounce.sendgrid_key'],
			(document) => [recordAt(document, 'bounce.azure'), 'shared_secret'],
			(document) => [recordAt(document, 'bounce.postmark'), 'password'],
			(document) => [recordAt(document, 'bounce.forwardemail'), 'key'],
			(document) => [recordAt(document, 'bounce.lettermint'), 'key'],
			(document) => [recordAt(recordAt(document, 'security.captcha'), 'hcaptcha'), 'secret'],
			(document) => [recordAt(document, 'security.oidc'), 'client_secret'],
		];

		for (const locate of secretParents) {
			const plaintext = createListmonkV62SettingsFixture();
			const [plaintextParent, field] = locate(plaintext);
			plaintextParent[field] = 'plaintext-secret';
			expect(() => validateListmonkV62SettingsDocument(plaintext), field).toThrow('invalid complete v6.2 settings document');

			const empty = createListmonkV62SettingsFixture();
			const [emptyParent, emptyField] = locate(empty);
			emptyParent[emptyField] = '';
			expect(validateListmonkV62SettingsDocument(empty), emptyField).toBe(empty);
		}
	});

	it('bounds provider collections and rejects non-integer Go int fields', () => {
		for (const key of ['smtp', 'messengers', 'bounce.mailboxes']) {
			const document = createListmonkV62SettingsFixture();
			const item = collectionItemAt(document, key);
			document[key] = Array.from({ length: 101 }, () => structuredClone(item));
			expect(() => validateListmonkV62SettingsDocument(document), key).toThrow(`at ${key}`);
		}

		const fractionalPort = createListmonkV62SettingsFixture();
		collectionItemAt(fractionalPort, 'smtp')['port'] = 587.5;
		expect(() => validateListmonkV62SettingsDocument(fractionalPort)).toThrow('at smtp.0.port');
	});
});
