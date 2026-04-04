import { type JSX } from 'solid-js';
import { Toaster } from 'solid-sonner';
import '~/admin.css';
import './admin.css';

export default function AdminLayout(props: { children: JSX.Element }) {
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
			{props.children}
		</>
	);
}
