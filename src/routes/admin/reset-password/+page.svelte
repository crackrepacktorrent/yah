<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";
  import { FormField, Input, Button, Logo } from "$lib/components/admin";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);

  let token = $derived(page.url.searchParams.get("token") ?? "");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = "";

    if (newPassword !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    if (newPassword.length < 8) {
      error = "Password must be at least 8 characters";
      return;
    }

    loading = true;

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (result.error) {
        error = result.error.message ?? "Failed to reset password";
        return;
      }

      toast.success("Password reset successfully. Please sign in.");
      goto("/admin/login");
    } catch {
      error = "Failed to reset password. The link may have expired.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-container">
    <Logo fill="#ff6f00" height={140} />

    {#if !token}
      <div class="success-card">
        <h2>Invalid reset link</h2>
        <p>This password reset link is invalid or has expired.</p>
        <a href="/admin/forgot-password" class="back-link">Request a new one</a>
      </div>
    {:else}
      <form onsubmit={handleSubmit}>
        <h2>Set new password</h2>

        <FormField label="New password">
          <Input type="password" bind:value={newPassword} required minlength={8} />
        </FormField>

        <FormField label="Confirm password">
          <Input type="password" bind:value={confirmPassword} required minlength={8} />
        </FormField>

        {#if error}
          <p class="error">{error}</p>
        {/if}

        <Button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>

        <a href="/admin/login" class="back-link">Back to login</a>
      </form>
    {/if}
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

  form, .success-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-surface);
    padding: 2rem;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    width: 100%;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-foreground);
  }

  .error {
    color: var(--color-destructive);
    margin: 0;
    font-size: 0.9rem;
  }

  .back-link {
    text-align: center;
    color: var(--color-primary);
    font-size: 0.9rem;
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
  }
</style>
