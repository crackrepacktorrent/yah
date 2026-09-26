import { defaultRolePermissions, type Permissions } from '@yah/admin-core/permissions';
import { describe, expect, it } from 'vitest';
import { emailNavigation, emailSettingsNavigation, primaryNavigation } from './navigation';

const owner = { permissions: defaultRolePermissions['owner'] };

describe('admin navigation', () => {
	it.each<[Permissions, string]>([
		[{ template: ['view'] }, '/emails'],
		[{ list: ['view'] }, '/emails/lists'],
		[{ campaign: ['view'] }, '/emails/campaigns'],
		[{ subscriber: ['view'] }, '/emails/subscribers'],
		[{ bounce: ['view'] }, '/emails/bounces'],
		[{ provider: ['manage'] }, '/emails/logs'],
		[{ settings: ['view'] }, '/settings/email/general'],
	])('links Email to an accessible page for permissions %j', (permissions, href) => {
		const session = { permissions };
		expect(primaryNavigation(session, '/').find(({ label }) => label === 'Email')?.href).toBe(href);
		expect(emailNavigation(session, href).some((item) => item.href === href && item.selected)).toBe(true);
	});

	it('consolidates settings into Email while preserving the templates landing page', () => {
		expect(primaryNavigation(owner, '/').map(({ label }) => label)).toEqual(['Dashboard', 'Analytics', 'Shortlinks', 'Email', 'Roles', 'Members']);
		expect(primaryNavigation(owner, '/').find(({ label }) => label === 'Email')?.href).toBe('/emails');
		expect(emailNavigation(owner, '/settings/email').find(({ label }) => label === 'Settings')).toMatchObject({
			href: '/settings/email/general', selected: true,
		});
	});

	it.each([
		['/', 'Dashboard'],
		['/analytics', 'Analytics'],
		['/shortlinks/code/details', 'Shortlinks'],
		['/emails/templates/new', 'Email'],
		['/settings/email', 'Email'],
		['/settings/email/privacy', 'Email'],
		['/roles/new', 'Roles'],
		['/members/invitations/new', 'Members'],
	])('selects only %s’s primary section', (pathname, label) => {
		expect(primaryNavigation(owner, pathname).filter(({ selected }) => selected).map((item) => item.label)).toEqual([label]);
	});

	it.each([
		['/emails/', 'Templates'],
		['/emails/templates/7', 'Templates'],
		['/emails/campaigns/new', 'Campaigns'],
		['/emails/analytics', 'Email analytics'],
		['/emails/lists/3', 'Lists'],
		['/emails/forms', 'Forms'],
		['/emails/subscribers/5', 'Subscribers'],
		['/emails/bounces', 'Bounces'],
		['/emails/logs', 'Logs'],
		['/settings/email/general', 'Settings'],
		['/settings/email/', 'Settings'],
	])('selects only %s’s email section', (pathname, label) => {
		expect(emailNavigation(owner, pathname).filter(({ selected }) => selected).map((item) => item.label)).toEqual([label]);
	});

	it('keeps settings read access independent of provider management', () => {
		expect(emailSettingsNavigation({ permissions: { settings: ['view'] } }, '/settings/email')
			.filter(({ selected }) => selected).map(({ label }) => label)).toEqual(['SMTP delivery']);
		expect(emailSettingsNavigation({ permissions: { provider: ['manage'] } }, '/settings/email')).toEqual([]);
		expect(emailNavigation({ permissions: { provider: ['manage'] } }, '/emails/logs').map(({ label }) => label)).toEqual(['Logs']);
	});

	it('does not expose view navigation for create/edit-only users or similar route prefixes', () => {
		expect(emailNavigation({ permissions: { template: ['create'], settings: ['edit'] } }, '/')).toEqual([]);
		expect(primaryNavigation(null, '/')).toEqual([{ href: '/', label: 'Dashboard', selected: true }]);
		expect(primaryNavigation(owner, '/emails-unrelated').some(({ selected }) => selected)).toBe(false);
		expect(primaryNavigation(owner, '/settings/email-unrelated').some(({ selected }) => selected)).toBe(false);
	});

	it('selects exactly one settings subsection', () => {
		for (const item of emailSettingsNavigation(owner, '')) {
			expect(emailSettingsNavigation(owner, item.href).filter(({ selected }) => selected).map(({ label }) => label)).toEqual([item.label]);
		}
	});
});
