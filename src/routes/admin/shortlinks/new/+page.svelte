<script lang="ts">
	import { goto } from '$app/navigation';
	import { Card, Button, FormField, Input, Switch } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import { createShortUrl } from '../../shortlinks.remote';

	let pending = $state(false);
	let forwardQuery = $state(true);
	let crawlable = $state(false);

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);

		pending = true;
		try {
			const result = await createShortUrl({
				longUrl: fd.get('longUrl') as string,
				customSlug: fd.get('customSlug') as string,
				title: fd.get('title') as string,
				tags: fd.get('tags') as string,
				maxVisits: fd.get('maxVisits') as string,
				validUntil: fd.get('validUntil') as string,
				crawlable,
				forwardQuery,
			});
			toast.success('Shortlink created.');
			goto(`/admin/shortlinks/${result.shortCode}`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create shortlink.');
		} finally {
			pending = false;
		}
	}
</script>

<h1>New Shortlink</h1>

<Card maxWidth="600px">
	<form class="create-form" onsubmit={handleCreate}>
		<FormField label="Destination URL" required>
			<Input name="longUrl" type="url" required placeholder="https://example.com/long/path" />
		</FormField>

		<FormField label="Custom Slug" hint="(optional — leave blank for auto-generated)">
			<Input name="customSlug" placeholder="my-link" />
		</FormField>

		<FormField label="Title" hint="(optional)">
			<Input name="title" placeholder="Descriptive title" />
		</FormField>

		<FormField label="Tags" hint="(comma-separated)">
			<Input name="tags" placeholder="campaign, social" />
		</FormField>

		<div class="row">
			<FormField label="Max Visits" hint="(optional)">
				<Input name="maxVisits" placeholder="Unlimited" />
			</FormField>

			<FormField label="Expires" hint="(optional)">
				<Input name="validUntil" type="date" min={new Date().toLocaleDateString('en-CA')} />
			</FormField>
		</div>

		<div class="switches">
			<Switch label="Forward query parameters" bind:checked={forwardQuery} name="forwardQuery" />
			<Switch label="Allow search engine crawling" bind:checked={crawlable} name="crawlable" />
		</div>

		<div class="actions">
			<Button variant="ghost" href="/admin/shortlinks">Cancel</Button>
			<Button variant="primary" type="submit" disabled={pending}>
				{pending ? 'Creating...' : 'Create Shortlink'}
			</Button>
		</div>
	</form>
</Card>

<style>
	h1 {
		margin-bottom: 1.5rem;
		color: var(--color-foreground);
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

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	.switches {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.5rem;
	}
</style>
