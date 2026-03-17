<script lang="ts">
  import { page } from "$app/stores";
  import { Dialog, Tooltip } from "bits-ui";
  import { Logo } from "$lib/components/admin";
  import { LayoutDashboard, Link, LogOut, Menu, X } from "lucide-svelte";
  import type { Component } from "svelte";

  const icons: Record<string, Component> = {
    dashboard: LayoutDashboard,
    link: Link,
  };

  export type NavItem = { href: string; label: string; icon: string };
  export type NavSection = { label: string; items: NavItem[] };

  let {
    sections,
    user,
    onlogout,
  }: {
    sections: NavSection[];
    user: { name?: string | null; email?: string | null } | null;
    onlogout: () => void;
  } = $props();

  let mobileOpen = $state(false);

  function isActive(href: string) {
    if (href === "/admin") return $page.url.pathname === "/admin";
    return $page.url.pathname.startsWith(href);
  }
</script>


{#snippet sidebarContent()}
  <div class="sidebar-header">
    <a href="/admin" class="brand">
      <Logo fill="var(--brand-cream)" height={72} />
    </a>
  </div>

  <nav class="sidebar-nav">
    {#each sections as section}
      <div class="nav-section">
        <span class="nav-section-label">{section.label}</span>
        {#each section.items as item}
          <a
            href={item.href}
            class="nav-item"
            class:active={isActive(item.href)}
            onclick={() => (mobileOpen = false)}
          >
            {#if icons[item.icon]}
              {@const Icon = icons[item.icon]}
              <Icon size={18} />
            {/if}
            <span>{item.label}</span>
          </a>
        {/each}
      </div>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <div class="user-info">
      <div class="user-avatar">
        {user?.name?.charAt(0) ?? user?.email?.charAt(0) ?? "?"}
      </div>
      <div class="user-details">
        <span class="user-name">{user?.name ?? "Admin"}</span>
        <span class="user-email">{user?.email}</span>
      </div>
    </div>
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="logout-btn"
              onclick={onlogout}
              aria-label="Sign out"
            >
              <LogOut size={18} />
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

<!-- Desktop sidebar -->
<aside class="sidebar desktop-only">
  {@render sidebarContent()}
</aside>

<!-- Mobile header + drawer -->
<header class="mobile-header mobile-only">
  <Dialog.Root bind:open={mobileOpen}>
    <Dialog.Trigger>
      {#snippet child({ props })}
        <button {...props} class="menu-toggle" aria-label="Open menu">
          <Menu size={20} />
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
                  <X size={18} />
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

<style>
  .sidebar {
    width: 240px;
    background: var(--brand-brown);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
  }

  .sidebar-header {
    padding: 1.5rem 1rem;
    background: var(--brand-brown-dark);
    display: flex;
    justify-content: center;
  }

  .brand {
    text-decoration: none;
    display: flex;
    align-items: center;
    transition: transform 300ms;
    transform: perspective(1px) translateZ(0);
  }

  .brand:hover {
    transform: scale(1.1) rotate(1deg);
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
    color: var(--brand-brown-lighter);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    text-decoration: none;
    font-size: 0.875rem;
    color: var(--brand-warm-200);
    transition:
      background 0.15s,
      color 0.15s;
  }

  .nav-item:hover {
    background: var(--brand-brown-hover);
    color: var(--brand-cream);
  }

  .nav-item.active {
    background: var(--brand-brown-active);
    color: var(--brand-amber-light);
    font-weight: 600;
  }

  .nav-tooltip {
    background: var(--brand-brown);
    color: var(--brand-cream);
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 50;
  }

  /* ─── Sidebar footer ───────────────────────────────────────────────── */

  .sidebar-footer {
    padding: 0.75rem 1rem;
    background: var(--brand-brown-dark);
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
    background: var(--brand-amber);
    color: var(--brand-brown);
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
    color: var(--brand-cream);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-email {
    font-size: 0.7rem;
    color: var(--brand-brown-lighter);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logout-btn {
    background: none;
    border: none;
    padding: 0.4rem;
    cursor: pointer;
    color: var(--brand-brown-lighter);
    border-radius: var(--radius-sm);
    transition:
      color 0.15s,
      background 0.15s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .logout-btn:hover {
    color: var(--brand-magenta-light);
    background: var(--brand-magenta-muted);
  }

  /* ─── Mobile ───────────────────────────────────────────────────────── */

  .mobile-only {
    display: none;
  }

  .drawer-overlay {
    position: fixed;
    inset: 0;
    background: var(--brand-brown-muted);
    z-index: 45;
  }

  .drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 50;
    box-shadow: 4px 0 16px var(--brand-brown-muted);
  }

  .drawer-close {
    position: absolute;
    top: 1rem;
    right: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--brand-brown-lighter);
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    z-index: 1;
  }

  .drawer-close:hover {
    color: var(--brand-cream);
  }

  @media (max-width: 768px) {
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
      background: var(--brand-brown);
      border-bottom: none;
      position: sticky;
      top: 0;
      z-index: 30;
    }

    .menu-toggle {
      background: none;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: var(--brand-cream);
      display: flex;
      align-items: center;
    }
  }
</style>
