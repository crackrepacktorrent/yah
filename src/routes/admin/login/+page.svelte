<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { FormField, Input, Button, Logo } from "$lib/components/admin";
  import { ORG_SLUG } from "$lib/constants";

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      error = result.error.message ?? "Login failed";
      loading = false;
      return;
    }

    const orgResult = await authClient.organization.setActive({
      organizationSlug: ORG_SLUG,
    });

    if (orgResult.error) {
      error = 'Signed in, but failed to load organization. Contact an admin.';
      loading = false;
      return;
    }

    goto("/admin");
  }
</script>

<div class="login-page">
  <div class="login-container">
    <Logo fill="#ff6f00" height={140} />

    <form onsubmit={handleLogin}>
      <FormField label="Email">
        <Input type="email" bind:value={email} required />
      </FormField>

      <FormField label="Password">
        <Input type="password" bind:value={password} required />
      </FormField>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <Button type="submit" disabled={loading} aria-busy={loading} class="login-btn">
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    background: var(--color-page-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-container {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .login-container :global(.logo) {
    margin-bottom: 2rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-surface);
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    width: 100%;
  }

  .error {
    color: var(--color-destructive);
    margin: 0;
    font-size: 0.9rem;
  }
</style>
