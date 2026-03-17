<script lang="ts">
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import { getEmblaContext } from "./context.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: { ref?: HTMLButtonElement | null; class?: string; [key: string]: unknown } = $props();

	const emblaCtx = getEmblaContext("<Carousel.Previous/>");
</script>

<button
	bind:this={ref}
	data-slot="carousel-previous"
	type="button"
	aria-disabled={!emblaCtx.canScrollPrev}
	class="carousel-nav-btn {emblaCtx.orientation === 'vertical' ? 'vertical' : 'horizontal'} prev {className ?? ''}"
	onclick={emblaCtx.scrollPrev}
	onkeydown={emblaCtx.handleKeyDown}
	{...restProps}
>
	<ArrowLeftIcon class="carousel-nav-icon" />
	<span class="sr-only">Previous slide</span>
</button>

<style>
	.carousel-nav-btn {
		position: absolute;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		touch-action: manipulation;
		border-radius: 9999px;
		background-color: var(--background);
		box-shadow: var(--shadow-sm);
		transition: background-color 150ms ease-in-out;
		cursor: pointer;
		border: 0;
		padding: 0;
	}

	.carousel-nav-btn:hover {
		background-color: var(--hover-bg);
	}

	.carousel-nav-btn[aria-disabled="true"] {
		pointer-events: none;
		opacity: 0.5;
	}

	.carousel-nav-btn.horizontal.prev {
		left: -1rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.carousel-nav-btn.vertical.prev {
		top: -3rem;
		left: 50%;
		transform: translateX(-50%) rotate(90deg);
	}

	:global(.carousel-nav-icon) {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-yahrange);
	}
</style>
