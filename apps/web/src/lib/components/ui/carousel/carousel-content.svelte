<script lang="ts">
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { getEmblaContext } from "./context.js";
	import type { WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const emblaCtx = getEmblaContext("<Carousel.Content/>");
</script>

<div
	data-slot="carousel-content"
	class="carousel-viewport"
	use:emblaCarouselSvelte={{
		options: {
			container: "[data-embla-container]",
			slides: "[data-embla-slide]",
			...emblaCtx.options,
			axis: emblaCtx.orientation === "horizontal" ? "x" : "y",
		},
		plugins: emblaCtx.plugins,
	}}
	onemblaInit={emblaCtx.onInit}
>
	<div
		bind:this={ref}
		class="carousel-container {emblaCtx.orientation === 'vertical' ? 'vertical' : ''} {className ?? ''}"
		data-embla-container=""
		{...restProps}
	>
		{@render children?.()}
	</div>
</div>

<style>
	.carousel-viewport {
		overflow: hidden;
	}

	.carousel-container {
		display: flex;
		margin-inline-start: -1rem;
	}

	.carousel-container.vertical {
		margin-inline-start: 0;
		margin-top: -1rem;
		flex-direction: column;
	}
</style>
