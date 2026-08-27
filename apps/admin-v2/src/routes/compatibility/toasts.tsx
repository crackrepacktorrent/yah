import { toast } from '~/ui/toast';

export default function ToastCompatibility() {
	return (
		<main class="shell">
			<p class="eyebrow">Dependency gallery</p>
			<h1>App-owned toast facade</h1>
			<p>
				<a href="/compatibility">Back to the platform smoke</a>
			</p>
			<div class="gallery-actions">
				<button type="button" onClick={() => toast.success('Settings saved.')}>Show success</button>
				<button type="button" onClick={() => toast.error('Settings could not be saved.')}>Show error</button>
			</div>
		</main>
	);
}
