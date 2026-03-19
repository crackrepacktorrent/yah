<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { getEmblaContext } from "./context.js";
	import type { WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const emblaCtx = getEmblaContext("<Carousel.Item/>");
</script>

<div
	bind:this={ref}
	data-slot="carousel-item"
	role="group"
	aria-roledescription="slide"
	class="carousel-slide {emblaCtx.orientation === 'vertical' ? 'vertical' : ''} {className ?? ''}"
	data-embla-slide=""
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	.carousel-slide {
		min-width: 0;
		flex-shrink: 0;
		flex-grow: 0;
		flex-basis: 100%;
		padding-inline-start: 1rem;
	}

	.carousel-slide.vertical {
		padding-inline-start: 0;
		padding-top: 1rem;
	}
</style>
