import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense, type ParentProps } from 'solid-js';
import { Toaster } from 'solid-sonner';
import './app.css';
import './admin.css';

function RootLayout(props: ParentProps) {
	return (
		<>
			<Toaster
				position="bottom-right"
				toastOptions={{
					style: { 'font-family': 'inherit' },
					classes: {
						success: 'toast-success',
						error: 'toast-error',
						warning: 'toast-warning',
						info: 'toast-info',
					},
				}}
			/>
			<Suspense>{props.children}</Suspense>
		</>
	);
}

export default function App() {
	return (
		<Router root={RootLayout}>
			<FileRoutes />
		</Router>
	);
}
