<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { FormField, Input, Button, Logo } from "$lib/components/admin";

  let email = $state("");
  let loading = $state(false);
  let sent = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/admin/reset-password",
      });
    } catch {
      // Silently ignore — don't reveal whether the email exists
    }

    // Always show success message to prevent email enumeration
    sent = true;
    loading = false;
  }
</script>

<div class="login-page">
  <div class="login-container">
    <Logo fill="#ff6f00" height={140} />

    {#if sent}
      <div class="success-card">
        <h2>Check your email</h2>
        <p>If an account exists for <strong>{email}</strong>, we've sent a password reset link.</p>
        <a href="/admin/login" class="back-link">Back to login</a>
      </div>
    {:else}
      <form onsubmit={handleSubmit}>
        <h2>Reset your password</h2>
        <p class="subtitle">Enter your email and we'll send you a reset link.</p>

        <FormField label="Email">
          <Input type="email" bind:value={email} required />
        </FormField>

        <Button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Sending..." : "Send reset link"}
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

  .subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-muted);
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
