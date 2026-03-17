<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    message,
    children,
  }: {
    message: string;
    children?: Snippet;
  } = $props();
</script>

<div class="empty-state">
  <p class="message">{message}</p>
  {#if children}
    <div class="action">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1rem;
    gap: 0.5rem;
  }

  .message {
    color: var(--color-muted);
    font-size: 0.95rem;
    margin: 0;
  }

  .action :global(a) {
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 500;
  }
</style>
