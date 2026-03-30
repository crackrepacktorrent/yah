import { EmptyState, PageHeader } from '~/components/admin';

export default function ImportPage() {
	return (
		<>
			<PageHeader title="Import Subscribers" />
			<EmptyState message="Subscriber import coming soon." />
		</>
	);
}
