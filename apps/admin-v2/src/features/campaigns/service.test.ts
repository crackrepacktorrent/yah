import { describe, expect, it, vi } from 'vitest';
import { CampaignProviderFailure, type CampaignDetail, type CreateCampaignCommand } from './contracts';
import {
	createAuthorizedCampaign,
	deleteAuthorizedCampaigns,
	previewAuthorizedCampaign,
	transitionAuthorizedCampaign,
	updateAuthorizedCampaign,
	type CampaignServiceDependencies,
} from './service';

const draft: CampaignDetail = {
	id: 21,
	uuid: '559197a8-c409-4c0f-8cad-851899d6c26a',
	type: 'regular',
	name: 'August update',
	subject: 'What happened in August',
	fromEmail: 'YAH <hello@example.test>',
	messenger: 'email',
	status: 'draft',
	contentType: 'richtext',
	templateId: 1,
	sendAt: null,
	startedAt: null,
	toSend: 10,
	sent: 0,
	views: 0,
	clicks: 0,
	bounces: 0,
	lists: [{ id: 11, name: 'News' }],
	tags: ['monthly'],
	createdAt: '2026-08-25T10:00:00Z',
	updatedAt: '2026-08-25T11:00:00Z',
	body: '<p>August news</p>',
};

const createCommand: CreateCampaignCommand = {
	type: 'regular',
	name: 'September update',
	subject: 'What happened in September',
	fromEmail: '',
	listIds: [11],
	body: '<p>September news</p>',
	contentType: 'richtext',
	templateId: 1,
	tags: ['monthly'],
	sendAt: null,
};

function dependencies(current: CampaignDetail | null = draft): CampaignServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		manager: {
			list: vi.fn(async () => current ? [current] : []),
			get: vi.fn(async () => current),
			create: vi.fn(async () => ({ ...draft, id: 22, ...createCommand, lists: draft.lists })),
			update: vi.fn(async () => current ?? draft),
			delete: vi.fn(async () => undefined),
			transition: vi.fn(async (_id, status) => ({ ...(current ?? draft), status })),
			preview: vi.fn(async () => '<p>Rendered campaign</p>'),
		},
		mailingLists: {
			list: vi.fn(async () => [
				{ id: 11, name: 'News', status: 'active' as const, optIn: 'double' as const },
				{ id: 12, name: 'Single', status: 'active' as const, optIn: 'single' as const },
				{ id: 13, name: 'Archived', status: 'archived' as const, optIn: 'double' as const },
			]),
		},
		templates: {
			get: vi.fn(async (id) => id === 1 ? { kind: 'campaign' as const } : id === 4 ? { kind: 'campaign_visual' as const } : id === 2 ? { kind: 'tx' as const } : null),
		},
	};
}

function updateCommand(overrides: Partial<Parameters<typeof updateAuthorizedCampaign>[0]> = {}) {
	return {
		id: draft.id,
		expectedUpdatedAt: draft.updatedAt,
		name: draft.name,
		subject: draft.subject,
		fromEmail: draft.fromEmail,
		listIds: [11],
		body: draft.body,
		contentType: 'richtext' as const,
		templateId: draft.templateId,
		tags: draft.tags,
		sendAt: draft.sendAt,
		...overrides,
	};
}

describe('campaign service', () => {
	it('authorizes regular creation with list access and optional template access', async () => {
		const deps = dependencies();
		await expect(createAuthorizedCampaign(createCommand, new Headers(), deps)).resolves.toEqual({ id: 22 });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(1, expect.any(Headers), { campaign: ['create'], list: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(2, expect.any(Headers), { template: ['view'] });
		expect(deps.manager.create).toHaveBeenCalledWith(createCommand);
	});

	it('does not require template access when the default template is selected', async () => {
		const deps = dependencies();
		await createAuthorizedCampaign({ ...createCommand, templateId: null }, new Headers(), deps);
		expect(deps.enforcePermissions).toHaveBeenCalledTimes(1);
	});

	it('rejects empty regular content, past schedules, missing or archived lists, and incompatible templates', async () => {
		await expect(createAuthorizedCampaign({ ...createCommand, body: ' ' }, new Headers(), dependencies())).rejects.toThrow('Enter campaign content');
		await expect(createAuthorizedCampaign({ ...createCommand, sendAt: '2020-01-01T00:00:00Z' }, new Headers(), dependencies())).rejects.toThrow('future');
		await expect(createAuthorizedCampaign({ ...createCommand, listIds: [99] }, new Headers(), dependencies())).rejects.toThrow('no longer exist');
		await expect(createAuthorizedCampaign({ ...createCommand, listIds: [13] }, new Headers(), dependencies())).rejects.toThrow('active');
		await expect(createAuthorizedCampaign({ ...createCommand, templateId: 2 }, new Headers(), dependencies())).rejects.toThrow('ordinary campaign email template');
		await expect(createAuthorizedCampaign({ ...createCommand, templateId: 4 }, new Headers(), dependencies())).rejects.toThrow('ordinary campaign email template');
	});

	it('creates a provider-owned opt-in message only for active double opt-in lists', async () => {
		const deps = dependencies();
		await createAuthorizedCampaign({ ...createCommand, type: 'optin', body: 'ignored', contentType: 'markdown' }, new Headers(), deps);
		expect(deps.manager.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'optin', body: '', contentType: 'richtext' }));
		await expect(createAuthorizedCampaign({ ...createCommand, type: 'optin', listIds: [12] }, new Headers(), dependencies())).rejects.toThrow('double opt-in');
	});

	it('re-fetches a draft, checks its version, and preserves provider-owned opt-in content', async () => {
		const optin = { ...draft, type: 'optin' as const, body: '<a href="{{ OptinURL }}">Confirm</a>' };
		const deps = dependencies(optin);
		await updateAuthorizedCampaign(updateCommand({ body: 'client does not own this' }), new Headers(), deps);
		expect(deps.manager.update).toHaveBeenCalledWith(expect.objectContaining({ body: optin.body, contentType: 'richtext' }));

		await expect(updateAuthorizedCampaign(updateCommand({ expectedUpdatedAt: '2026-08-25T12:00:00Z' }), new Headers(), dependencies())).rejects.toThrow('changed after');
		await expect(updateAuthorizedCampaign(updateCommand(), new Headers(), dependencies({ ...draft, status: 'scheduled' }))).rejects.toThrow('Only draft');
		await expect(updateAuthorizedCampaign(updateCommand(), new Headers(), dependencies({ ...draft, contentType: 'visual' }))).rejects.toThrow('visual editor');
	});

	it('enforces the exact status graph and a future schedule on the server', async () => {
		const scheduledDraft = { ...draft, sendAt: '2099-01-01T00:00:00Z' };
		const scheduleDeps = dependencies(scheduledDraft);
		await transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition: 'schedule' }, new Headers(), scheduleDeps);
		expect(scheduleDeps.manager.transition).toHaveBeenCalledWith(21, 'scheduled');

		const unscheduleDeps = dependencies({ ...scheduledDraft, status: 'scheduled' });
		await transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition: 'unschedule' }, new Headers(), unscheduleDeps);
		expect(unscheduleDeps.manager.transition).toHaveBeenCalledWith(21, 'draft');

		await expect(transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition: 'start' }, new Headers(), dependencies(scheduledDraft))).rejects.toThrow('Remove the scheduled time');
		await expect(transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition: 'cancel' }, new Headers(), dependencies({ ...draft, status: 'scheduled' }))).rejects.toThrow('running or paused');

		for (const [status, transition, target] of [
			['draft', 'start', 'running'],
			['running', 'pause', 'paused'],
			['paused', 'resume', 'running'],
			['paused', 'cancel', 'cancelled'],
		] as const) {
			const deps = dependencies({ ...draft, status });
			await transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition }, new Headers(), deps);
			expect(deps.manager.transition).toHaveBeenCalledWith(21, target);
		}

		const scheduledResume = dependencies({ ...draft, status: 'paused', sendAt: '2099-01-01T00:00:00Z' });
		await transitionAuthorizedCampaign({ id: 21, expectedUpdatedAt: draft.updatedAt, transition: 'resume' }, new Headers(), scheduledResume);
		expect(scheduledResume.manager.transition).toHaveBeenCalledWith(21, 'scheduled');
	});

	it('revalidates every selected draft before one bounded bulk delete', async () => {
		const second = { ...draft, id: 22, uuid: 'f127232f-c059-412c-9f8f-8a839be2a08b' };
		const deps = dependencies();
		deps.manager.list = vi.fn(async () => [draft, second]);
		await deleteAuthorizedCampaigns({ campaigns: [
			{ id: draft.id, expectedUpdatedAt: draft.updatedAt },
			{ id: second.id, expectedUpdatedAt: second.updatedAt },
		] }, new Headers(), deps);
		expect(deps.manager.delete).toHaveBeenCalledTimes(1);
		expect(deps.manager.delete).toHaveBeenCalledWith([21, 22]);

		const unsafe = dependencies();
		unsafe.manager.list = vi.fn(async () => [{ ...draft, status: 'running' as const }]);
		await expect(deleteAuthorizedCampaigns({ campaigns: [{ id: 21, expectedUpdatedAt: draft.updatedAt }] }, new Headers(), unsafe)).rejects.toThrow('Only draft');
		expect(unsafe.manager.delete).not.toHaveBeenCalled();
	});

	it('maps expected provider failures without leaking diagnostics', async () => {
		const createDeps = dependencies();
		createDeps.manager.create = vi.fn(async () => { throw new CampaignProviderFailure(400); });
		await expect(createAuthorizedCampaign(createCommand, new Headers(), createDeps)).rejects.toThrow('rejected these campaign settings');

		const previewDeps = dependencies();
		previewDeps.manager.preview = vi.fn(async () => { throw new CampaignProviderFailure(422); });
		await expect(previewAuthorizedCampaign(21, new Headers(), previewDeps)).rejects.toThrow('could not render');
	});
});
