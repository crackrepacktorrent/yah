import { visibleError } from './visible-error';
import './error-view.css';

function visibleMessage(error: unknown): string {
	return visibleError(error, 'An unexpected error occurred.');
}

export function ErrorView(props: { error: unknown; reset: () => void; onRetry?: () => void; title?: string; backHref?: string }) {
	function retry(): void {
		props.onRetry?.();
		props.reset();
	}

	return (
		<section class="error-view" role="alert">
			<h1>{props.title ?? 'Something went wrong'}</h1>
			<p>{visibleMessage(props.error)}</p>
			<div class="error-view__actions">
				<button type="button" onClick={retry}>
					Try again
				</button>
				<a href={props.backHref ?? '/'}>Back to Dashboard</a>
			</div>
		</section>
	);
}
