<script lang="ts">
  import "$lib/components/admin/admin.css";
  import { Sidebar } from "$lib/components/admin";
  import type { LayoutData } from "./$types";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { Toaster } from "svelte-sonner";

  let { data, children }: { data: LayoutData; children: any } = $props();

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
</script>

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
    <Sidebar
      sections={navSections}
      user={data.user}
      onlogout={handleLogout}
    />

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

  main {
    flex: 1;
    padding: 2rem;
    min-width: 0;
  }

  @media (max-width: 768px) {
    .admin-layout {
      flex-direction: column;
    }

    main {
      padding: 1.25rem 1rem;
    }
  }
</style>
