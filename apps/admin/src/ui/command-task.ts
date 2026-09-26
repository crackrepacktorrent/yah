import { createSignal } from 'solid-js';
import { visibleError } from './visible-error';

/** Own only the mechanics shared by user-triggered async commands. */
export function createCommandTask() {
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	// Solid batches signal writes; guard commands before the pending UI commits.
	let running = false;

	async function run(command: () => Promise<void>, fallback: string): Promise<boolean> {
		if (running) return false;
		running = true;
		setError('');
		setPending(true);
		try {
			await command();
			return true;
		} catch (caught) {
			setError(visibleError(caught, fallback));
			return false;
		} finally {
			running = false;
			setPending(false);
		}
	}

	return { pending, error, run, clearError: () => setError('') };
}
