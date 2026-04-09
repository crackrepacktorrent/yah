import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Toaster } from 'solid-sonner';
import './app.css';
import './admin.css';

export default function App() {
	return (
		<Router>
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
			<FileRoutes />
		</Router>
	);
}
