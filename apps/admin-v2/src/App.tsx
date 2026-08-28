import { revalidate } from '@solidjs/router';
import { Errored, Loading } from 'solid-js';
import { Router } from '~/router';
import { ErrorView } from '~/ui/error-view';
import { Toaster } from '~/ui/toast';
import './app.css';

export default function App() {
	return (
		<>
			<Toaster />
			<Errored fallback={(error, reset) => <ErrorView error={error()} reset={reset} onRetry={() => revalidate()} />}>
				<Router>
					{(props) => (
						<Loading
							fallback={
								<main class="admin-loading" role="status">
									<span class="admin-spinner" aria-hidden="true" />
									<span class="visually-hidden">Loading admin…</span>
								</main>
							}
						>
							{props.children}
						</Loading>
					)}
				</Router>
			</Errored>
		</>
	);
}
