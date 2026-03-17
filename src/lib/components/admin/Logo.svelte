<script lang="ts">
  import { LOGO_VIEWBOX, LOGO_ASPECT_RATIO, LOGO_PATH, LOGO_TRANSFORM } from "./logo-path";

  let {
    fill = "currentColor",
    height = 64,
  }: {
    fill?: string;
    height?: number;
  } = $props();

  let width = $derived(Math.round(height * LOGO_ASPECT_RATIO));
</script>

<svg
  class="logo"
  viewBox={LOGO_VIEWBOX}
  xmlns="http://www.w3.org/2000/svg"
  {width}
  {height}
>
  <g
    transform={LOGO_TRANSFORM}
    {fill}
    stroke="none"
  >
    <path d={LOGO_PATH} />
  </g>
</svg>

<style>
  .logo {
    display: block;
  }
</style>
