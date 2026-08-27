import { describe, expect, it, vi } from 'vitest';
import type { Permissions } from '@yah/admin-core/permissions';
import type { EditableShortlink, Shortlink, ShortlinkDetail, ShortlinkOverview } from './contracts';
import {
	createAuthorizedShortlink,
	deleteAuthorizedShortlink,
	editAuthorizedShortlink,
	listAuthorizedShortlinks,
	readAuthorizedEditableShortlink,
	readAuthorizedShortlink,
	readAuthorizedShortlinkOverview,
	requireAuthorizedShortlinkCapability,
	resetAuthorizedShortlinkVisits,
	type ShortlinkManager,
} from './service';

const shortlink: Shortlink = {
	shortCode: 'press-kit',
	shortUrl: 'https://y4h.org/press-kit',
	longUrl: 'https://example.test/press',
	dateCreated: '2026-08-26T12:00:00Z',
	title: 'Press kit',
	tags: ['press'],
	crawlable: false,
	forwardQuery: true,
	visits: { total: 4, nonBots: 3, bots: 1 },
	maxVisits: null,
	validUntil: null,
};
const detail: ShortlinkDetail = { shortlink, recentVisits: [], totalVisits: 0 };
const editable: EditableShortlink = {
	shortCode: shortlink.shortCode,
	longUrl: shortlink.longUrl,
	title: shortlink.title,
	tags: shortlink.tags,
	crawlable: shortlink.crawlable,
	forwardQuery: shortlink.forwardQuery,
	maxVisits: shortlink.maxVisits,
	validUntil: shortlink.validUntil,
};
const overview: ShortlinkOverview = { totalShortlinks: 1, visits: shortlink.visits, recentShortlinks: [shortlink] };

function setup() {
	const enforcePermissions = vi.fn(async (_headers: Headers, _permissions: Permissions) => undefined);
	const manager: ShortlinkManager = {
		list: vi.fn(async () => [shortlink]),
		getDetail: vi.fn(async () => detail),
		getEditable: vi.fn(async () => editable),
		create: vi.fn(async () => ({ shortCode: shortlink.shortCode })),
		edit: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
		resetVisits: vi.fn(async () => ({ deletedCount: 4 })),
		getOverview: vi.fn(async () => overview),
	};
	return { dependencies: { enforcePermissions, manager }, enforcePermissions, manager };
}

const validCreate = {
	longUrl: 'https://example.test/press',
	customSlug: 'press-kit',
	title: ' Press kit ',
	tags: [' press ', 'press', 'media'],
	maxVisits: 10,
	validUntil: '2026-09-30T12:00:00Z',
	crawlable: false,
	forwardQuery: true,
};

describe('shortlink service boundary', () => {
	it('validates before authorization and provider access', async () => {
		const setupResult = setup();
		await expect(
			createAuthorizedShortlink({ ...validCreate, longUrl: 'javascript:alert(1)' }, new Headers(), setupResult.dependencies),
		).rejects.toThrow('Only HTTP and HTTPS URLs are supported.');
		expect(setupResult.enforcePermissions).not.toHaveBeenCalled();
		expect(setupResult.manager.create).not.toHaveBeenCalled();
	});

	it('rejects extra command keys and invalid integer/date/tag/code values', async () => {
		for (const input of [
			{ ...validCreate, unexpected: true },
			{ ...validCreate, maxVisits: 1.5 },
			{ ...validCreate, validUntil: 'not-a-date' },
			{ ...validCreate, customSlug: 'bad/path' },
			{ ...validCreate, tags: [''] },
		]) {
			const setupResult = setup();
			await expect(createAuthorizedShortlink(input, new Headers(), setupResult.dependencies)).rejects.toThrow();
			expect(setupResult.enforcePermissions).not.toHaveBeenCalled();
		}
	});

	it('normalizes typed create data, deduplicates tags, and uses create authority', async () => {
		const setupResult = setup();
		await expect(createAuthorizedShortlink(validCreate, new Headers(), setupResult.dependencies)).resolves.toEqual({
			ok: true,
			shortCode: 'press-kit',
		});
		expect(setupResult.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { shortlink: ['create'] });
		expect(setupResult.manager.create).toHaveBeenCalledWith({
			...validCreate,
			title: 'Press kit',
			tags: ['press', 'media'],
		});
	});

	it('never crosses the provider boundary after denied authorization', async () => {
		const setupResult = setup();
		setupResult.enforcePermissions.mockRejectedValue(new Error('forbidden'));
		await expect(listAuthorizedShortlinks(new Headers(), setupResult.dependencies)).rejects.toThrow('forbidden');
		expect(setupResult.manager.list).not.toHaveBeenCalled();
	});

	it('uses the exact permission for every operation', async () => {
		const setupResult = setup();
		const { customSlug: _customSlug, ...validEdit } = validCreate;
		await listAuthorizedShortlinks(new Headers(), setupResult.dependencies);
		await readAuthorizedShortlink('press-kit', new Headers(), setupResult.dependencies);
		await readAuthorizedEditableShortlink('press-kit', new Headers(), setupResult.dependencies);
		await readAuthorizedShortlinkOverview(new Headers(), setupResult.dependencies);
		await editAuthorizedShortlink({ ...validEdit, shortCode: 'press-kit' }, new Headers(), setupResult.dependencies);
		await resetAuthorizedShortlinkVisits('press-kit', new Headers(), setupResult.dependencies);
		await deleteAuthorizedShortlink('press-kit', new Headers(), setupResult.dependencies);
		expect(setupResult.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
			{ shortlink: ['view'] },
			{ shortlink: ['view'] },
			{ shortlink: ['edit'] },
			{ shortlink: ['view'] },
			{ shortlink: ['edit'] },
			{ shortlink: ['edit'] },
			{ shortlink: ['delete'] },
		]);
	});

	it('returns only editable configuration to an edit-only route', async () => {
		const setupResult = setup();
		await expect(readAuthorizedEditableShortlink('press-kit', new Headers(), setupResult.dependencies)).resolves.toEqual(editable);
		expect(setupResult.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { shortlink: ['edit'] });
		expect(setupResult.manager.getEditable).toHaveBeenCalledWith('press-kit');
		expect(setupResult.manager.getDetail).not.toHaveBeenCalled();
		expect(editable).not.toHaveProperty('recentVisits');
		expect(editable).not.toHaveProperty('visits');
	});

	it('validates a direct route capability before checking it', async () => {
		const setupResult = setup();
		await expect(requireAuthorizedShortlinkCapability('create', new Headers(), setupResult.dependencies)).resolves.toBe(true);
		expect(setupResult.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { shortlink: ['create'] });

		const invalid = setup();
		await expect(requireAuthorizedShortlinkCapability('publish', new Headers(), invalid.dependencies)).rejects.toThrow();
		expect(invalid.enforcePermissions).not.toHaveBeenCalled();
	});

	it('maps absence and conflict to stable public errors', async () => {
		const missing = setup();
		vi.mocked(missing.manager.getDetail).mockResolvedValue(null);
		await expect(readAuthorizedShortlink('missing', new Headers(), missing.dependencies)).rejects.toThrow('Shortlink not found.');

		const conflict = setup();
		// Start Mode can duplicate custom-error constructors across lazy chunks.
		vi.mocked(conflict.manager.create).mockRejectedValue({
			name: 'ShortlinkProviderFailure',
			status: 400,
			problemType: 'non-unique-slug',
		});
		await expect(createAuthorizedShortlink(validCreate, new Headers(), conflict.dependencies)).resolves.toEqual({
			ok: false,
			reason: 'conflict',
		});
	});

	it('never deletes the seven short codes embedded in printed QR materials', async () => {
		for (const shortCode of ['signup', 'training', 'campus-training', 'sign-in', 'join', 'whatsapp', 'donate']) {
			const setupResult = setup();
			await expect(deleteAuthorizedShortlink(shortCode, new Headers(), setupResult.dependencies)).rejects.toMatchObject({
				name: 'PublicError',
				status: 409,
				message: 'This shortlink backs a printed QR code and cannot be deleted.',
			});
			expect(setupResult.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { shortlink: ['delete'] });
			expect(setupResult.manager.delete).not.toHaveBeenCalled();
		}
	});
});
