<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { SITE_URL } from '$lib/config';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
	let unavailable = $derived(
		!data.available || Boolean(form && 'unavailable' in form && form.unavailable)
	);
	const title = 'Subscribe | Youth Alliance for Housing';
	const description = 'Subscribe to Youth Alliance for Housing email updates.';
	const canonicalUrl = `${SITE_URL}/subscribe`;
	const socialImage = `${SITE_URL}/og-image.png`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={socialImage} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={socialImage} />
	<link rel="canonical" href={canonicalUrl} />
</svelte:head>

<div class="subscribe-page" class:subscribe-page-embed={data.embedded}>
	<div class="subscribe-card">
		<h1>Subscribe</h1>

		{#if form?.success}
			<div class="success-message" role="status" aria-live="polite">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 6L9 17l-5-5"/>
				</svg>
				<p>
					{form.hasOptin
						? "You're almost subscribed. Check your inbox to confirm your subscription."
						: "You're subscribed."}
				</p>
			</div>
		{:else}
			{#if unavailable}
				<div class="error-message" role="alert">
					Subscriptions are temporarily unavailable. Please try again later.
				</div>
			{:else}
				<p class="subscribe-description">Enter your details below to subscribe to our mailing list.</p>

				{#if form?.error}
					<div class="error-message" role="alert" aria-live="assertive">{form.error}</div>
				{/if}

				<form method="POST" use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							submitting = false;
						}
					};
				}}>
					<div class="honeypot" aria-hidden="true">
						<label for="website">Website</label>
						<input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
					</div>
					<div class="form-fields">
						<div class="field">
							<label for="email">Email <span class="required">*</span></label>
							<input
								id="email"
								type="email"
								name="email"
								autocomplete="email"
								maxlength="320"
								required
								placeholder="you@example.com"
								value={form?.email ?? ''}
							/>
						</div>

						<div class="field">
							<label for="name">Name</label>
							<input
								id="name"
								type="text"
								name="name"
								autocomplete="name"
								maxlength="255"
								placeholder="Your name (optional)"
								value={form?.name ?? ''}
							/>
						</div>

						<fieldset class="field">
							<legend>Lists</legend>
							<div class="list-options">
								{#each data.lists as list}
									<label class="list-option">
										<input
											type="checkbox"
											name="list"
											value={list.uuid}
											checked={data.preselectedUuids.includes(list.uuid) || data.lists.length === 1}
										/>
										<span>{list.name}</span>
									</label>
								{/each}
							</div>
							{#if data.lists.length > 20}
								<p class="field-hint">Choose up to 20 lists.</p>
							{/if}
						</fieldset>

						<button type="submit" class="submit-btn" disabled={submitting}>
							{submitting ? 'Subscribing...' : 'Subscribe'}
						</button>
					</div>
				</form>
			{/if}
		{/if}
	</div>
</div>

<style>
	.subscribe-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: var(--color-page-bg, #f5f5f5);
		font-family: var(--font-body, 'Rubik Variable', system-ui, sans-serif);
	}

	.subscribe-page-embed {
		min-height: 0;
		padding: 1rem;
	}

	.subscribe-card {
		background: var(--color-surface, #fff);
		border-radius: var(--radius-lg, 0.625rem);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 4px 12px rgb(0 0 0 / 0.05);
		padding: 2rem;
		width: 100%;
		max-width: 440px;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-foreground, #1a1a1a);
	}

	.subscribe-description {
		margin: 0 0 1.5rem;
		color: var(--color-muted, #666);
		font-size: 0.9rem;
	}

	.error-message {
		background: var(--color-destructive-bg, #fee);
		color: var(--brand-magenta-dark, #c00);
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md, 0.5rem);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.success-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem 0;
		text-align: center;
		color: var(--brand-olive, #4a7c3f);
	}

	.success-message p {
		margin: 0;
		font-size: 1rem;
		color: var(--color-foreground, #1a1a1a);
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.honeypot {
		position: absolute;
		left: -10000px;
		top: auto;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	label, legend {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-foreground, #1a1a1a);
	}

	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}

	.required {
		color: var(--brand-magenta, #c00);
	}

	input[type='email'],
	input[type='text'] {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-border, #ddd);
		border-radius: var(--radius-md, 0.5rem);
		background: var(--color-surface, #fff);
		color: var(--color-foreground, #1a1a1a);
		font-size: 0.9rem;
		font-family: inherit;
	}

	input[type='email']:focus,
	input[type='text']:focus {
		outline: none;
		border-color: var(--color-primary, #3b82f6);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3b82f6) 25%, transparent);
	}

	.list-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.list-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 400;
		cursor: pointer;
	}

	.list-option input[type='checkbox'] {
		accent-color: var(--color-primary, #3b82f6);
	}

	.field-hint {
		margin: 0;
		color: var(--color-muted, #666);
		font-size: 0.8rem;
	}

	.submit-btn {
		padding: 0.65rem 1.25rem;
		background: var(--color-primary, #3b82f6);
		color: #fff;
		border: none;
		border-radius: var(--radius-md, 0.5rem);
		font-size: 0.9rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		margin-top: 0.25rem;
		transition: opacity 0.15s ease;
	}

	.submit-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
