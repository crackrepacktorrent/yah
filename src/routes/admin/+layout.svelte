<script lang="ts">
  import "$lib/components/admin/admin.css";
  import { Sidebar, Spinner } from "$lib/components/admin";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { Toaster } from "svelte-sonner";
  import { getSession } from "./session.remote";
  import { can } from "./can";

  let { children }: { children: any } = $props();

  let session = $derived(getSession());

  const navSections = $derived.by(() => {
    const sections = [
      {
        label: "Home",
        items: [
          { href: "/admin", label: "Dashboard", icon: "dashboard" },
          { href: "/admin/shortlinks", label: "Shortlinks", icon: "link" },
          { href: "/admin/analytics", label: "Analytics", icon: "chart" },
        ],
      },
      {
        label: "Email",
        items: [
          {
            href: "/admin/emails/campaigns",
            label: "Campaigns",
            icon: "megaphone",
            children: [
              { href: "/admin/emails/campaigns", label: "All Campaigns", icon: "megaphone" },
              { href: "/admin/emails", label: "Templates", icon: "mail" },
              { href: "/admin/emails/media", label: "Media", icon: "image" },
              { href: "/admin/emails/analytics", label: "Analytics", icon: "pie-chart" },
            ],
          },
          {
            href: "/admin/emails/subscribers",
            label: "Subscribers",
            icon: "contact",
            children: [
              { href: "/admin/emails/subscribers", label: "All Subscribers", icon: "contact" },
              { href: "/admin/emails/bounces", label: "Bounces", icon: "alert-circle" },
            ],
          },
          {
            href: "/admin/emails/lists",
            label: "Lists",
            icon: "list-checks",
            children: [
              { href: "/admin/emails/lists", label: "All Lists", icon: "list-checks" },
              { href: "/admin/emails/forms", label: "Forms", icon: "clipboard-list" },
            ],
          },
        ],
      },
    ];

    if (can(session.current, 'member', 'create')) {
      sections.push({
        label: "Organization",
        items: [
          { href: "/admin/members", label: "Members", icon: "users" },
          { href: "/admin/roles", label: "Roles", icon: "shield" },
        ],
      });
    }

    return sections;
  });

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

{#if page.url.pathname === "/admin/login" || page.url.pathname.startsWith("/admin/members/accept")}
  {@render children()}
{:else}
  <div class="admin-layout">
    <Sidebar
      sections={navSections}
      user={session.current?.user ?? null}
      onlogout={handleLogout}
    />

    <main>
      <svelte:boundary onerror={(e) => console.error('[admin]', e)}>
        {@render children()}
        {#snippet pending()}
          <div class="loading-state">
            <Spinner size={48} centered />
          </div>
        {/snippet}
        {#snippet failed(error: unknown, reset: () => void)}
          <div class="error-boundary">
            <h2>Something went wrong</h2>
            <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
            <div class="error-actions">
              <button class="error-btn" onclick={reset}>Try again</button>
              <a href="/admin" class="error-link">Back to Dashboard</a>
            </div>
          </div>
        {/snippet}
      </svelte:boundary>
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

  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    gap: 0.75rem;
  }

  .error-boundary h2 {
    margin: 0;
    color: var(--color-foreground);
    font-size: 1.25rem;
  }

  .error-boundary p {
    margin: 0;
    color: var(--color-muted);
    max-width: 400px;
  }

  .error-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .error-btn {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-foreground);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .error-btn:hover {
    background: var(--color-hover);
  }

  .error-link {
    color: var(--color-primary);
    font-size: 0.9rem;
    text-decoration: none;
  }

  .error-link:hover {
    text-decoration: underline;
  }
</style>
