<script lang="ts">
	import '$lib/components/admin/admin.css';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { Dialog, Tooltip } from 'bits-ui';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let mobileOpen = $state(false);

	const navSections = [
		{
			label: 'Home',
			items: [
				{ href: '/admin', label: 'Dashboard', icon: 'dashboard' },
				{ href: '/admin/shortlinks', label: 'Shortlinks', icon: 'link' },
			],
		},
	];

	async function handleLogout() {
		await authClient.signOut();
		goto('/admin/login');
	}

	function isActive(href: string) {
		if (href === '/admin') return $page.url.pathname === '/admin';
		return $page.url.pathname.startsWith(href);
	}
</script>

{#snippet icon(name: string)}
	{#if name === 'dashboard'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="7" height="7"></rect>
			<rect x="14" y="3" width="7" height="7"></rect>
			<rect x="3" y="14" width="7" height="7"></rect>
			<rect x="14" y="14" width="7" height="7"></rect>
		</svg>
	{:else if name === 'link'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
		</svg>
	{/if}
{/snippet}

{#snippet sidebarContent()}
	<div class="sidebar-header">
		<a href="/admin" class="brand">
			<img src="/yah-logo.png" alt="YAH" class="brand-logo" />
		</a>
	</div>

	<nav class="sidebar-nav">
		{#each navSections as section}
			<div class="nav-section">
				<span class="nav-section-label">{section.label}</span>
				{#each section.items as item}
					<a
						href={item.href}
						class="nav-item"
						class:active={isActive(item.href)}
						onclick={() => (mobileOpen = false)}
					>
						{@render icon(item.icon)}
						<span>{item.label}</span>
					</a>
				{/each}
			</div>
		{/each}
	</nav>

	<div class="sidebar-footer">
		<div class="user-info">
			<div class="user-avatar">
				{data.user?.name?.charAt(0) ?? data.user?.email?.charAt(0) ?? '?'}
			</div>
			<div class="user-details">
				<span class="user-name">{data.user?.name ?? 'Admin'}</span>
				<span class="user-email">{data.user?.email}</span>
			</div>
		</div>
		<Tooltip.Provider delayDuration={300}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button {...props} class="logout-btn" onclick={handleLogout}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
								<polyline points="16 17 21 12 16 7"></polyline>
								<line x1="21" y1="12" x2="9" y2="12"></line>
							</svg>
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content sideOffset={8} side="right">
						{#snippet child({ props })}
							<div {...props} class="nav-tooltip">Sign out</div>
						{/snippet}
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
{/snippet}

{#if $page.url.pathname === '/admin/login'}
	{@render children()}
{:else}
	<div class="admin-layout">
		<!-- Desktop sidebar -->
		<aside class="sidebar desktop-only">
			{@render sidebarContent()}
		</aside>

		<!-- Mobile header + drawer -->
		<header class="mobile-header mobile-only">
			<Dialog.Root bind:open={mobileOpen}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<button {...props} class="menu-toggle">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="3" y1="6" x2="21" y2="6"></line>
								<line x1="3" y1="12" x2="21" y2="12"></line>
								<line x1="3" y1="18" x2="21" y2="18"></line>
							</svg>
						</button>
					{/snippet}
				</Dialog.Trigger>

				<Dialog.Portal>
					<Dialog.Overlay>
						{#snippet child({ props })}
							<div {...props} class="drawer-overlay"></div>
						{/snippet}
					</Dialog.Overlay>
					<Dialog.Content>
						{#snippet child({ props })}
							<aside {...props} class="sidebar drawer">
								<Dialog.Close>
									{#snippet child({ props: closeProps })}
										<button {...closeProps} class="drawer-close">
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
										</button>
									{/snippet}
								</Dialog.Close>
								{@render sidebarContent()}
							</aside>
						{/snippet}
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</header>

		<!-- Main content -->
		<main>
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.admin-layout {
		display: flex;
		min-height: 100vh;
		background: #f5f5f7;
	}

	/* ─── Sidebar ──────────────────────────────────────────────────────── */

	.sidebar {
		width: 240px;
		background: #fff;
		border-right: 1px solid var(--admin-border-light);
		display: flex;
		flex-direction: column;
		height: 100vh;
		position: sticky;
		top: 0;
	}

	.sidebar-header {
		padding: 1.5rem 1rem;
		border-bottom: 1px solid var(--admin-border-light);
		display: flex;
		justify-content: center;
	}

	.brand {
		text-decoration: none;
		display: flex;
		align-items: center;
	}

	.brand-logo {
		height: 64px;
		width: auto;
	}

	.sidebar-nav {
		flex: 1;
		padding: 0.5rem;
		overflow-y: auto;
	}

	.nav-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-section-label {
		padding: 0.4rem 0.75rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--admin-muted);
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		font-size: 0.875rem;
		color: var(--admin-muted);
		transition: background 0.15s, color 0.15s;
	}

	.nav-item:hover {
		background: var(--admin-border-light);
		color: var(--color-yahblack);
	}

	.nav-item.active {
		background: var(--admin-border-light);
		color: var(--color-yahblack);
		font-weight: 600;
	}

	.nav-tooltip {
		background: var(--color-yahblack);
		color: #fff;
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		white-space: nowrap;
		z-index: 50;
	}

	/* ─── Sidebar footer ───────────────────────────────────────────────── */

	.sidebar-footer {
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--admin-border-light);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.user-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-yahrange);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 600;
		flex-shrink: 0;
		text-transform: uppercase;
	}

	.user-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.user-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-yahblack);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: 0.7rem;
		color: var(--admin-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.logout-btn {
		background: none;
		border: none;
		padding: 0.4rem;
		cursor: pointer;
		color: var(--admin-muted);
		border-radius: var(--radius-sm);
		transition: color 0.15s, background 0.15s;
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.logout-btn:hover {
		color: var(--destructive);
		background: var(--destructive-bg);
	}

	/* ─── Main content ─────────────────────────────────────────────────── */

	main {
		flex: 1;
		padding: 2rem;
		min-width: 0;
	}

	/* ─── Mobile ───────────────────────────────────────────────────────── */

	.mobile-only {
		display: none;
	}

	.drawer-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 45;
	}

	.drawer {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 50;
		box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
	}

	.drawer-close {
		position: absolute;
		top: 1rem;
		right: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--admin-muted);
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		z-index: 1;
	}

	.drawer-close:hover {
		color: var(--color-yahblack);
	}

	@media (max-width: 768px) {
		.admin-layout {
			flex-direction: column;
		}

		.desktop-only {
			display: none;
		}

		.mobile-only {
			display: flex;
		}

		.mobile-header {
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem 1rem;
			background: #fff;
			border-bottom: 1px solid var(--admin-border-light);
			position: sticky;
			top: 0;
			z-index: 30;
		}

		.menu-toggle {
			background: none;
			border: none;
			padding: 0.25rem;
			cursor: pointer;
			color: var(--color-yahblack);
			display: flex;
			align-items: center;
		}

		main {
			padding: 1.25rem 1rem;
		}
	}
</style>
