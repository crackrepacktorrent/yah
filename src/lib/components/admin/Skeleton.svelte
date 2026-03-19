<script lang="ts">
  let {
    width = "100%",
    height = "1rem",
    radius = "var(--radius-md)",
  }: {
    width?: string;
    height?: string;
    radius?: string;
  } = $props();
</script>

<div
  class="skeleton"
  style:width={width}
  style:height={height}
  style:border-radius={radius}
></div>

<style>
  .skeleton {
    background: var(--color-border);
    opacity: 0.3;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.15; }
  }
</style>
