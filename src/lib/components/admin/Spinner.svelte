<script lang="ts">
  let {
    size = 24,
    centered = false,
  }: {
    size?: number;
    centered?: boolean;
  } = $props();
</script>

{#if centered}
  <div class="spinner-container">
    <svg
      class="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle class="track" cx="12" cy="12" r="10" stroke-width="3" />
      <path class="arc" d="M12 2a10 10 0 0 1 10 10" stroke-width="3" stroke-linecap="round" />
    </svg>
  </div>
{:else}
  <svg
    class="spinner"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle class="track" cx="12" cy="12" r="10" stroke-width="3" />
    <path class="arc" d="M12 2a10 10 0 0 1 10 10" stroke-width="3" stroke-linecap="round" />
  </svg>
{/if}

<style>
  .spinner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem 0;
  }

  .spinner {
    display: block;
    animation: spin 0.8s linear infinite;
  }

  .track {
    stroke: var(--color-border);
    opacity: 0.3;
  }

  .arc {
    stroke: var(--brand-orange);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
