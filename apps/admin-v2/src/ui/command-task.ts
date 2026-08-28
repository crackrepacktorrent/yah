import { createSignal } from 'solid-js';
import { visibleError } from './visible-error';

/** Own only the mechanics shared by user-triggered async commands. */
export function createCommandTask() {
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function run(command: () => Promise<void>, fallback: string): Promise<void> {
		setError('');
		setPending(true);
		try {
			await command();
		} catch (caught) {
			setError(visibleError(caught, fallback));
		} finally {
			setPending(false);
		}
	}

	return { pending, error, run };
}
