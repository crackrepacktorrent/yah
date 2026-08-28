export default function NotFound() {
	return (
		<main class="error-view">
			<h1>Page not found</h1>
			<p>The page you requested does not exist.</p>
			<div class="error-view__actions"><a href="/">Back to Dashboard</a></div>
		</main>
	);
}
