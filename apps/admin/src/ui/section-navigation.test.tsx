import { createRouter, memoryHistory, useIsRouting, useLocation, useNavigate, type Navigator } from '@solidjs/router';
import { render } from '@solidjs/web';
import { defaultRolePermissions } from '@yah/admin-core/permissions';
import { Loading, createMemo } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailNavigation, primaryNavigation } from './navigation';
import { SectionNavigation } from './section-navigation';

const disposers: Array<() => void> = [];

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('section navigation with router-managed anchors', () => {
	it('keeps the current section when an async exact-to-child navigation finishes', async () => {
		const history = memoryHistory('/emails/campaigns');
		const owner = { permissions: defaultRolePermissions['owner'] };
		const routeData = new Map<string, Promise<string>>();
		let navigate!: Navigator;
		let isRouting!: () => boolean;
		const Router = createRouter({
			history,
			routes: [{
				path: '/*page',
				component: () => {
					const location = useLocation();
					const data = createMemo(() => routeData.get(location.pathname) ?? Promise.resolve(location.pathname));
					return <span>{data()}</span>;
				},
			}],
		});
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => (
			<Router>
				{(props) => {
					const location = useLocation();
					navigate = useNavigate();
					isRouting = useIsRouting();
					return (
						<>
							<SectionNavigation label="Primary navigation" items={primaryNavigation(owner, location.pathname)} />
							<SectionNavigation label="Email management" items={emailNavigation(owner, location.pathname)} />
							<Loading fallback="Loading route">{props.children}</Loading>
						</>
					);
				}}
			</Router>
		), container));

		await vi.waitFor(() => {
			expect(container.textContent).toContain('/emails/campaigns');
			expect(isRouting()).toBe(false);
		});

		for (const [pathname, emailSection] of [
			['/emails/campaigns/21', 'Campaigns'],
			['/emails', 'Templates'],
			['/emails/templates/7', 'Templates'],
			['/settings/email/general', 'Settings'],
			['/settings/email', 'Settings'],
			['/emails/campaigns', 'Campaigns'],
		] as const) {
			let resolveData!: (value: string) => void;
			routeData.set(pathname, new Promise((resolve) => { resolveData = resolve; }));
			navigate(pathname, { scroll: false });
			await vi.waitFor(() => expect(isRouting()).toBe(true));
			resolveData(pathname);
			await vi.waitFor(() => {
				expect(isRouting()).toBe(false);
				expect(container.textContent).toContain(pathname);
				expect([...container.querySelectorAll('[aria-label="Primary navigation"] a[aria-current="page"]')].map((anchor) => anchor.textContent)).toEqual(['Email']);
				expect([...container.querySelectorAll('[aria-label="Email management"] a[aria-current="page"]')].map((anchor) => anchor.textContent)).toEqual([emailSection]);
			});
		}
	});
});
