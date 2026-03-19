<script lang="ts">
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import { getEmblaContext } from "./context.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: { ref?: HTMLButtonElement | null; class?: string; [key: string]: unknown } = $props();

	const emblaCtx = getEmblaContext("<Carousel.Next/>");
</script>

<button
	bind:this={ref}
	data-slot="carousel-next"
	type="button"
	aria-disabled={!emblaCtx.canScrollNext}
	class="carousel-nav-btn {emblaCtx.orientation === 'vertical' ? 'vertical' : 'horizontal'} next {className ?? ''}"
	onclick={emblaCtx.scrollNext}
	onkeydown={emblaCtx.handleKeyDown}
	{...restProps}
>
	<ArrowRightIcon class="carousel-nav-icon" />
	<span class="sr-only">Next slide</span>
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
		background-color: var(--color-background);
		box-shadow: var(--shadow-sm);
		transition: background-color 150ms ease-in-out;
		cursor: pointer;
		border: 0;
		padding: 0;
	}

	.carousel-nav-btn:hover {
		background-color: var(--color-hover);
	}

	.carousel-nav-btn[aria-disabled="true"] {
		pointer-events: none;
		opacity: 0.5;
	}

	.carousel-nav-btn.horizontal.next {
		right: -1rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.carousel-nav-btn.vertical.next {
		bottom: -3rem;
		left: 50%;
		transform: translateX(-50%) rotate(90deg);
	}

	:global(.carousel-nav-icon) {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-primary);
	}
</style>
