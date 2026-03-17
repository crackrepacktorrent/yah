<script lang="ts">
	import { Card, Button, FormField, Switch } from '$lib/components/admin';
	import { createShortUrl } from '../../shortlinks.remote';
	let forwardQuery = $state(true);
	let crawlable = $state(false);
</script>

<h1>New Shortlink</h1>

<Card maxWidth="600px">
	<form {...createShortUrl} class="create-form">
		<FormField label="Destination URL" required>
			<input {...createShortUrl.fields.longUrl.as('url')} class="admin-input" required placeholder="https://example.com/long/path" />
		</FormField>

		{#each createShortUrl.fields.longUrl.issues() as issue}
			<p class="error">{issue.message}</p>
		{/each}

		<FormField label="Custom Slug" hint="(optional — leave blank for auto-generated)">
			<input {...createShortUrl.fields.customSlug.as('text')} class="admin-input" placeholder="my-link" />
		</FormField>

		<FormField label="Title" hint="(optional)">
			<input {...createShortUrl.fields.title.as('text')} class="admin-input" placeholder="Descriptive title" />
		</FormField>

		<FormField label="Tags" hint="(comma-separated)">
			<input {...createShortUrl.fields.tags.as('text')} class="admin-input" placeholder="campaign, social" />
		</FormField>

		<div class="row">
			<FormField label="Max Visits" hint="(optional)">
				<input {...createShortUrl.fields.maxVisits.as('text')} class="admin-input" placeholder="Unlimited" />
			</FormField>

			<FormField label="Expires" hint="(optional)">
				<input {...createShortUrl.fields.validUntil.as('text')} type="date" class="admin-input" min={new Date().toISOString().slice(0, 10)} />
			</FormField>
		</div>

		<div class="switches">
			<Switch label="Forward query parameters" bind:checked={forwardQuery} name="forwardQuery" />
			<Switch label="Allow search engine crawling" bind:checked={crawlable} name="crawlable" />
		</div>

		<div class="actions">
			<Button variant="ghost" href="/admin/shortlinks">Cancel</Button>
			<Button variant="primary" type="submit" disabled={createShortUrl.pending}>
				{createShortUrl.pending ? 'Creating...' : 'Create Shortlink'}
			</Button>
		</div>
	</form>
</Card>

<style>
	h1 {
		margin-bottom: 1.5rem;
		color: var(--color-yahblack);
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.switches {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.error {
		color: var(--destructive);
		margin: 0;
		font-size: 0.9rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.5rem;
	}
</style>
