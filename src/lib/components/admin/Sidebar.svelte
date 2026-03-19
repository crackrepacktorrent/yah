<script lang="ts">
  import { page } from "$app/state";
  import { Collapsible, Dialog, Tooltip } from "bits-ui";
  import { Logo } from "$lib/components/admin";
  import {
    AlertCircle, BarChart3, ChevronRight, ClipboardList, Contact,
    Image, LayoutDashboard, Link, ListChecks, LogOut, Mail,
    Megaphone, Menu, PieChart, Shield, Users, X,
  } from "lucide-svelte";

  const icons: Record<string, any> = {
    dashboard: LayoutDashboard,
    link: Link,
    chart: BarChart3,
    mail: Mail,
    users: Users,
    contact: Contact,
    'list-checks': ListChecks,
    'alert-circle': AlertCircle,
    shield: Shield,
    megaphone: Megaphone,
    image: Image,
    'pie-chart': PieChart,
    'clipboard-list': ClipboardList,
  };

  export type NavItem = {
    href: string;
    label: string;
    icon: string;
    children?: { href: string; label: string; icon?: string }[];
  };
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

  // Track collapsible open state per nav item, keyed by href
  let collapsibleOpen = $state<Record<string, boolean>>({});

  function isCollapsibleOpen(href: string) {
    return collapsibleOpen[href] ?? false;
  }

  function setCollapsibleOpen(href: string, value: boolean) {
    collapsibleOpen[href] = value;
  }

  function isActive(href: string) {
    const path = page.url.pathname;
    if (href === "/admin") return path === "/admin";
    return path === href;
  }

  function hasActiveChild(item: NavItem) {
    if (!item.children?.length) return false;
    const path = page.url.pathname;
    return item.children.some((child) => path === child.href);
  }

  // Auto-open collapsibles when navigating to a child route
  $effect(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.length && hasActiveChild(item)) {
          collapsibleOpen[item.href] = true;
        }
      }
    }
  });
</script>

{#snippet navItem(item: NavItem)}
  {#if item.children?.length}
    <!-- Collapsible parent with sub-items -->
    <Collapsible.Root open={isCollapsibleOpen(item.href)} onOpenChange={(v) => setCollapsibleOpen(item.href, v)}>
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            class="nav-item nav-collapsible-trigger"
            class:active={hasActiveChild(item)}
          >
            {#if icons[item.icon]}
              {@const Icon = icons[item.icon]}
              <Icon size={18} />
            {/if}
            <span class="nav-item-label">{item.label}</span>
            <ChevronRight size={14} class="nav-chevron" />
          </button>
        {/snippet}
      </Collapsible.Trigger>
      <Collapsible.Content class="nav-sub">
        {#each item.children ?? [] as child}
          <a
            href={child.href}
            class="nav-sub-item"
            class:active={isActive(child.href)}
            onclick={() => (mobileOpen = false)}
          >
            {#if child.icon && icons[child.icon]}
              {@const SubIcon = icons[child.icon]}
              <SubIcon size={14} />
            {/if}
            <span>{child.label}</span>
          </a>
        {/each}
      </Collapsible.Content>
    </Collapsible.Root>
  {:else}
    <!-- Simple nav link -->
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
      <span class="nav-item-label">{item.label}</span>
    </a>
  {/if}
{/snippet}

{#snippet sidebarContent()}
  <div class="sidebar-header">
    <a href="/admin" class="brand">
      <Logo fill="var(--brand-magenta-light)" height={72} />
    </a>
  </div>

  <nav class="sidebar-nav">
    {#each sections as section}
      <div class="nav-section">
        <span class="nav-section-label">{section.label}</span>
        {#each section.items as item}
          {@render navItem(item)}
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
    gap: 3px;
  }

  .nav-section-label {
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--brand-brown-lighter);
  }

  /* ─── Nav items (links + collapsible triggers) ─────────────────────── */

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

  .nav-item-label {
    flex: 1;
  }

  /* ─── Collapsible trigger ──────────────────────────────────────────── */

  .nav-collapsible-trigger {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .nav-collapsible-trigger :global(.nav-chevron) {
    flex-shrink: 0;
    color: var(--brand-brown-lighter);
    transition: transform 0.2s ease;
  }

  :global([data-state="open"]) > :global(.nav-chevron) {
    transform: rotate(90deg);
  }

  /* ─── Sub-items (collapsible children) ─────────────────────────────── */

  :global(.nav-sub[data-state="open"]) {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :global(.nav-sub) {
    margin-top: 2px;
    margin-left: 1.25rem;
    padding-left: 0.75rem;
    border-left: 1px solid var(--brand-brown-hover);
  }

  .nav-sub-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius-md);
    text-decoration: none;
    font-size: 0.825rem;
    color: var(--brand-warm-200);
    transition:
      background 0.15s,
      color 0.15s;
  }

  .nav-sub-item:hover {
    background: var(--brand-brown-hover);
    color: var(--brand-cream);
  }

  .nav-sub-item.active {
    background: var(--brand-brown-active);
    color: var(--brand-amber-light);
    font-weight: 600;
  }

  /* ─── Tooltip ──────────────────────────────────────────────────────── */

  .nav-tooltip {
    background: var(--brand-brown);
    color: var(--brand-cream);
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: var(--z-tooltip);
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
    z-index: var(--z-sidebar-backdrop);
  }

  .drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: var(--z-sidebar);
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
    z-index: var(--z-base);
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
      z-index: var(--z-sidebar-backdrop);
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
