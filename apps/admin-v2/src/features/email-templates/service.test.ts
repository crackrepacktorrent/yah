import type { Permissions } from '@yah/admin-core/permissions';
import { describe, expect, it, vi } from 'vitest';
import { TemplateProviderFailure, type EmailTemplateDetail } from './contracts';
import {
	createAuthorizedEmailTemplate,
	deleteAuthorizedEmailTemplate,
	listAuthorizedEmailTemplates,
	previewAuthorizedEditedEmailTemplate,
	previewAuthorizedNewEmailTemplate,
	readAuthorizedEmailTemplate,
	requireAuthorizedEmailTemplateCapability,
	setAuthorizedDefaultEmailTemplate,
	updateAuthorizedEmailTemplate,
	type EmailTemplateManager,
} from './service';

const transactional: EmailTemplateDetail = {
	id: 5,
	name: 'Admin access',
	kind: 'tx',
	subject: 'Your access link',
	body: '<a href="{{ .Tx.Data.access_link }}">Open admin</a>',
	hasVisualSource: false,
	isDefault: false,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-02T00:00:00Z',
};
const campaign: EmailTemplateDetail = {
	...transactional,
	id: 1,
	name: 'Newsletter wrapper',
	kind: 'campaign',
	subject: '',
	body: '<main>{{ template "content" . }}</main>',
	isDefault: true,
};
const visual: EmailTemplateDetail = {
	...campaign,
	id: 7,
	name: 'Visual newsletter',
	kind: 'campaign_visual',
	hasVisualSource: true,
	isDefault: false,
};

function dependencies(existing: EmailTemplateDetail | null = transactional) {
	const enforcePermissions = vi.fn(async (_permissions: Permissions) => undefined);
	const manager: EmailTemplateManager = {
		list: vi.fn(async () => [campaign, transactional]),
		get: vi.fn(async () => existing),
		create: vi.fn(async (input) => ({ ...transactional, ...input, id: 9, isDefault: false })),
		update: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
		setDefault: vi.fn(async () => undefined),
		previewSaved: vi.fn(async () => '<html>saved</html>'),
		previewDraft: vi.fn(async () => '<html>draft</html>'),
	};
	return {
		authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
		enforcePermissions,
		manager,
	};
}

describe('email-template service boundary', () => {
	it('rejects malformed commands before authorization or provider access', async () => {
		const deps = dependencies();
		await expect(
			createAuthorizedEmailTemplate(
				{ name: '', kind: 'tx', subject: '', body: '<p>body</p>' },
				deps,
			),
		).rejects.toThrow('Enter a template name.');
		expect(deps.enforcePermissions).not.toHaveBeenCalled();
		expect(deps.manager.create).not.toHaveBeenCalled();

		await expect(readAuthorizedEmailTemplate(0, deps)).rejects.toThrow('Select a valid email template.');
		expect(deps.enforcePermissions).not.toHaveBeenCalled();
	});

	it('enforces every capability independently before provider access', async () => {
		const deps = dependencies();
		await requireAuthorizedEmailTemplateCapability('create', deps);
		await listAuthorizedEmailTemplates(deps);
		await readAuthorizedEmailTemplate(5, deps);
		await createAuthorizedEmailTemplate({ name: 'Tx', kind: 'tx', subject: 'Subject', body: '<p>body</p>' }, deps);
		await updateAuthorizedEmailTemplate({ id: 5, name: 'Tx', subject: 'Subject', body: '<p>body</p>' }, deps);
		await deleteAuthorizedEmailTemplate(5, deps);

		expect(deps.enforcePermissions.mock.calls.map(([permission]) => permission)).toEqual([
			{ template: ['create'] },
			{ template: ['view'] },
			{ template: ['view'] },
			{ template: ['create'] },
			{ template: ['edit'] },
			{ template: ['delete'] },
		]);
	});

	it('never invokes Listmonk after authorization is denied', async () => {
		const deps = dependencies();
		deps.enforcePermissions.mockRejectedValue(new Error('forbidden'));
		await expect(listAuthorizedEmailTemplates(deps)).rejects.toThrow('forbidden');
		await expect(
			createAuthorizedEmailTemplate({ name: 'Tx', kind: 'tx', subject: 'Subject', body: '<p>body</p>' }, deps),
		).rejects.toThrow('forbidden');
		expect(deps.manager.list).not.toHaveBeenCalled();
		expect(deps.manager.create).not.toHaveBeenCalled();
	});

	it('requires exactly one campaign content slot but not for transactional HTML', async () => {
		for (const body of ['<main>No slot</main>', '{{ template "content" . }}{{ template "content" . }}']) {
			const deps = dependencies();
			await expect(
				createAuthorizedEmailTemplate({ name: 'Campaign', kind: 'campaign', subject: '', body }, deps),
			).rejects.toThrow('exactly one');
			expect(deps.enforcePermissions).not.toHaveBeenCalled();
		}

		const deps = dependencies();
		await expect(
			createAuthorizedEmailTemplate({ name: 'Campaign', kind: 'campaign', subject: '', body: campaign.body }, deps),
		).resolves.toEqual({ id: 9 });
		await expect(
			createAuthorizedEmailTemplate({ name: 'Campaign', kind: 'campaign', subject: '', body: '{{template "content".}}' }, deps),
		).resolves.toEqual({ id: 9 });
		await expect(
			createAuthorizedEmailTemplate({ name: 'Tx', kind: 'tx', subject: 'Subject', body: '<p>No slot</p>' }, deps),
		).resolves.toEqual({ id: 9 });
	});

	it('requires a nonblank subject for transactional templates', async () => {
		const createDeps = dependencies();
		await expect(
			createAuthorizedEmailTemplate({ name: 'Tx', kind: 'tx', subject: '   ', body: '<p>body</p>' }, createDeps),
		).rejects.toThrow('Enter a subject');
		expect(createDeps.enforcePermissions).not.toHaveBeenCalled();
		expect(createDeps.manager.create).not.toHaveBeenCalled();

		const updateDeps = dependencies(transactional);
		await expect(
			updateAuthorizedEmailTemplate({ id: 5, name: 'Tx', subject: '', body: '<p>body</p>' }, updateDeps),
		).rejects.toThrow('Enter a subject');
		expect(updateDeps.manager.update).not.toHaveBeenCalled();
	});

	it('keeps visual templates read-only and validates edits against immutable kind', async () => {
		const visualDeps = dependencies(visual);
		await expect(
			updateAuthorizedEmailTemplate({ id: 7, name: 'Visual', subject: '', body: '<p>changed</p>' }, visualDeps),
		).rejects.toThrow('Visual template content is read-only');
		expect(visualDeps.manager.update).not.toHaveBeenCalled();

		const campaignDeps = dependencies({ ...campaign, isDefault: false });
		await expect(
			updateAuthorizedEmailTemplate({ id: 1, name: 'Campaign', subject: '', body: '<p>missing</p>' }, campaignDeps),
		).rejects.toThrow('exactly one');
		expect(campaignDeps.manager.update).not.toHaveBeenCalled();
	});

	it('prevents default deletion and limits default selection to HTML campaigns', async () => {
		const defaultDeps = dependencies(campaign);
		await expect(deleteAuthorizedEmailTemplate(1, defaultDeps)).rejects.toThrow('cannot be deleted');
		expect(defaultDeps.manager.delete).not.toHaveBeenCalled();

		const txDeps = dependencies(transactional);
		await expect(setAuthorizedDefaultEmailTemplate(5, txDeps)).rejects.toThrow('Only HTML campaign templates');
		expect(txDeps.manager.setDefault).not.toHaveBeenCalled();

		const campaignDeps = dependencies({ ...campaign, isDefault: false });
		await setAuthorizedDefaultEmailTemplate(1, campaignDeps);
		expect(campaignDeps.enforcePermissions).toHaveBeenCalledWith({ template: ['set-default'] });
		expect(campaignDeps.manager.setDefault).toHaveBeenCalledWith(1);
	});

	it('returns stable not-found and conflict errors without provider diagnostics', async () => {
		const missing = dependencies(null);
		await expect(readAuthorizedEmailTemplate(99, missing)).rejects.toMatchObject({ status: 404 });

		const raced = dependencies({ ...transactional, isDefault: false });
		vi.mocked(raced.manager.delete).mockRejectedValue(new TemplateProviderFailure(409));
		await expect(deleteAuthorizedEmailTemplate(5, raced)).rejects.toMatchObject({ status: 409 });
	});

	it('maps provider syntax rejection separately from mutation races', async () => {
		const createDeps = dependencies();
		vi.mocked(createDeps.manager.create).mockRejectedValue(new TemplateProviderFailure(400));
		await expect(
			createAuthorizedEmailTemplate({ name: 'Tx', kind: 'tx', subject: 'Subject', body: '{{ invalid }}' }, createDeps),
		).rejects.toMatchObject({ status: 400, message: 'Listmonk rejected the template HTML or expressions.' });

		const updateDeps = dependencies(transactional);
		vi.mocked(updateDeps.manager.update).mockRejectedValue(new TemplateProviderFailure(400));
		await expect(
			updateAuthorizedEmailTemplate({ id: 5, name: 'Tx', subject: 'Subject', body: '{{ invalid }}' }, updateDeps),
		).rejects.toMatchObject({ status: 400, message: 'Listmonk rejected the template HTML or expressions.' });

		const previewDeps = dependencies(transactional);
		vi.mocked(previewDeps.manager.previewDraft).mockRejectedValue(new TemplateProviderFailure(400));
		await expect(
			previewAuthorizedNewEmailTemplate({ kind: 'tx', body: '{{ invalid }}' }, previewDeps),
		).rejects.toMatchObject({ status: 400, message: 'Listmonk could not render this template. Check its HTML and template expressions.' });
	});

	it('uses saved preview for viewers and validated draft preview for authors', async () => {
		const deps = dependencies(campaign);
		await expect(previewAuthorizedNewEmailTemplate({ kind: 'campaign', body: campaign.body }, deps)).resolves.toBe(
			'<html>draft</html>',
		);
		await expect(previewAuthorizedEditedEmailTemplate({ id: 1, body: campaign.body }, deps)).resolves.toBe(
			'<html>draft</html>',
		);
		expect(deps.manager.previewDraft).toHaveBeenNthCalledWith(1, { kind: 'campaign', body: campaign.body });
		expect(deps.manager.previewDraft).toHaveBeenNthCalledWith(2, { kind: 'campaign', body: campaign.body });
	});
});
