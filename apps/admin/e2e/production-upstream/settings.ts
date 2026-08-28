import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, requestJson, acceptListmonkRequest, isFixtureRecord, storedSecret, preserveCollectionSecrets, preserveScalarSecret, preserveNestedSecret } from './http';
import { fixtureState } from './state';

export async function handleListmonkSettings(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/settings' && request.method === 'GET') {
		sendJson(response, {
			data: structuredClone(fixtureState.listmonkSettings),
		});
		return;
	}
	if (url.pathname === '/api/settings' && request.method === 'PUT') {
		const body = await requestJson(request);
		for (const key of ['smtp', 'messengers', 'bounce.mailboxes']) preserveCollectionSecrets(body, fixtureState.listmonkSettings, key);
		for (const key of ['upload.s3.aws_secret_access_key', 'bounce.sendgrid_key']) preserveScalarSecret(body, fixtureState.listmonkSettings, key);
		for (const [key, secretKey] of [
			['bounce.azure', 'shared_secret'],
			['bounce.postmark', 'password'],
			['bounce.forwardemail', 'key'],
			['bounce.lettermint', 'key'],
			['security.oidc', 'client_secret'],
		] as const)
			preserveNestedSecret(body, fixtureState.listmonkSettings, key, secretKey);
		const nextCaptcha = body['security.captcha'];
		const currentCaptcha = fixtureState.listmonkSettings['security.captcha'];
		if (isFixtureRecord(nextCaptcha) && isFixtureRecord(nextCaptcha['hcaptcha'])) {
			const currentHcaptcha = isFixtureRecord(currentCaptcha) && isFixtureRecord(currentCaptcha['hcaptcha']) ? currentCaptcha['hcaptcha'] : undefined;
			nextCaptcha['hcaptcha'] = {
				...nextCaptcha['hcaptcha'],
				secret: storedSecret(nextCaptcha['hcaptcha']['secret'], currentHcaptcha?.['secret']),
			};
		}
		fixtureState.listmonkSettings = structuredClone(body);
		sendJson(response, { data: true });
		return;
	}
	if (url.pathname === '/api/settings/smtp/test' && request.method === 'POST') {
		const body = await requestJson(request);
		fixtureState.smtpTestRequests.push({
			authProtocol: body['auth_protocol'],
			email: body['email'],
			hadPassword: typeof body['password'] === 'string' && body['password'].length > 0,
			host: body['host'],
		});
		sendJson(response, { data: ['Fixture SMTP message accepted.'] });
		return;
	}
	if (url.pathname === '/api/logs' && request.method === 'GET') {
		sendJson(response, { data: fixtureState.listmonkLogs });
		return;
	}

	sendJson(response, { message: 'Unknown fixture Listmonk settings endpoint.' }, 404);
}
