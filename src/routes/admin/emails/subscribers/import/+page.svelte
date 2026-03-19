<script lang="ts">
	import { Breadcrumb, EmptyState } from '$lib/components/admin';
</script>

<Breadcrumb items={[{ label: 'Subscribers', href: '/admin/emails/subscribers' }, { label: 'Import' }]} />

<h1>Import Subscribers</h1>
<EmptyState message="Subscriber import coming soon." />
