<script lang="ts">
	import type { RenderComponentConfig, RenderSnippetConfig } from './render-helpers';

	let {
		content,
		context
	}: {
		content: any;
		context: any;
	} = $props();

	type Resolved =
		| { type: 'string'; value: string }
		| { type: 'component'; value: RenderComponentConfig<any> }
		| { type: 'snippet'; value: RenderSnippetConfig<any> };

	function resolve(c: any, ctx: any): Resolved {
		if (typeof c === 'string') {
			return { type: 'string', value: c };
		}
		if (typeof c === 'function') {
			const result = c(ctx);
			if (typeof result === 'string') {
				return { type: 'string', value: result };
			}
			if (result && typeof result === 'object' && 'snippet' in result) {
				return { type: 'snippet', value: result };
			}
			if (result && typeof result === 'object' && 'component' in result) {
				return { type: 'component', value: result };
			}
			return { type: 'string', value: String(result ?? '') };
		}
		if (c && typeof c === 'object' && 'snippet' in c) {
			return { type: 'snippet', value: c };
		}
		if (c && typeof c === 'object' && 'component' in c) {
			return { type: 'component', value: c };
		}
		return { type: 'string', value: String(c ?? '') };
	}

	let resolved = $derived(resolve(content, context));
</script>

{#if resolved.type === 'string'}
	{resolved.value}
{:else if resolved.type === 'snippet'}
	{@render resolved.value.snippet(resolved.value.params)}
{:else}
	<resolved.value.component {...resolved.value.props} />
{/if}
