<script lang="ts">
  import "$lib/components/admin/admin.css";
  import { Logo } from "$lib/components/admin";
  import type { LayoutData } from "./$types";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { Dialog, Tooltip } from "bits-ui";
  import { Toaster } from "svelte-sonner";

  let { data, children }: { data: LayoutData; children: any } = $props();

  let mobileOpen = $state(false);

  const navSections = [
    {
      label: "Home",
      items: [
        { href: "/admin", label: "Dashboard", icon: "dashboard" },
        { href: "/admin/shortlinks", label: "Shortlinks", icon: "link" },
      ],
    },
  ];

  async function handleLogout() {
    await authClient.signOut();
    goto("/admin/login");
  }

  function isActive(href: string) {
    if (href === "/admin") return $page.url.pathname === "/admin";
    return $page.url.pathname.startsWith(href);
  }
</script>

{#snippet icon(name: string)}
  {#if name === "dashboard"}
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
    </svg>
  {:else if name === "link"}
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      ></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      ></path>
    </svg>
  {/if}
{/snippet}

{#snippet sidebarContent()}
  <div class="sidebar-header">
    <a href="/admin" class="brand">
      <Logo fill="var(--brand-cream)" height={72} />
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
        {data.user?.name?.charAt(0) ?? data.user?.email?.charAt(0) ?? "?"}
      </div>
      <div class="user-details">
        <span class="user-name">{data.user?.name ?? "Admin"}</span>
        <span class="user-email">{data.user?.email}</span>
      </div>
    </div>
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="logout-btn"
              onclick={handleLogout}
              aria-label="Sign out"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
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

<Toaster
  position="bottom-right"
  toastOptions={{
    style: 'font-family: inherit;',
    classes: {
      success: 'toast-success',
      error: 'toast-error',
      warning: 'toast-warning',
      info: 'toast-info',
    },
  }}
/>

{#if $page.url.pathname === "/admin/login"}
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
            <button {...props} class="menu-toggle" aria-label="Open menu">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
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
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
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
  /* ─── Toast theming (global — renders in portal) ─────────────────── */

  :global(.toast-success) {
    --normal-bg: var(--color-success-bg) !important;
    --normal-border: var(--brand-olive-light) !important;
    --normal-text: var(--brand-olive-dark) !important;
    border: 1px solid var(--brand-olive-light) !important;
  }

  :global(.toast-error) {
    --normal-bg: var(--color-destructive-bg) !important;
    --normal-border: var(--brand-magenta-light) !important;
    --normal-text: var(--brand-magenta-dark) !important;
    border: 1px solid var(--brand-magenta-light) !important;
  }

  :global(.toast-warning) {
    --normal-bg: var(--color-warning-bg) !important;
    --normal-border: var(--brand-amber) !important;
    --normal-text: var(--brand-amber-dark) !important;
    border: 1px solid var(--brand-amber) !important;
  }

  :global(.toast-info) {
    --normal-bg: var(--color-surface) !important;
    --normal-border: var(--color-border) !important;
    --normal-text: var(--color-foreground) !important;
    border: 1px solid var(--color-border) !important;
  }
  .admin-layout {
    display: flex;
    min-height: 100vh;
    background: var(--color-page-bg);
  }

  /* ─── Sidebar ──────────────────────────────────────────────────────── */

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

    main {
      padding: 1.25rem 1rem;
    }
  }
</style>
