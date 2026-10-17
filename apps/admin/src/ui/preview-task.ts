import { createSignal, onCleanup } from 'solid-js';
import { visibleError } from './visible-error';

/** Ignore responses invalidated by an edit, close, or owner disposal. */
export function createPreviewTask() {
	const [html, setHtml] = createSignal('');
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	let generation = 0;
	let running = false;
	let disposed = false;
	onCleanup(() => { disposed = true; generation += 1; });

	function clear(): void {
		generation += 1;
		running = false;
		setPending(false);
		setHtml('');
		setError('');
	}

	async function load(render: () => Promise<string>, fallback: string): Promise<void> {
		if (running || disposed) return;
		running = true;
		const current = ++generation;
		setPending(true);
		setError('');
		try {
			const document = await render();
			if (current === generation) setHtml(document);
		} catch (caught) {
			if (current === generation) {
				setHtml('');
				setError(visibleError(caught, fallback));
			}
		} finally {
			if (current === generation) { running = false; setPending(false); }
		}
	}

	return { html, pending, error, clear, load };
}
