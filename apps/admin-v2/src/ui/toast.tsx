import { For, createSignal, onSettled, untrack } from 'solid-js';
import './toast.css';

const MAX_TOASTS = 4;
const SUCCESS_DURATION_MS = 8_000;

type ToastKind = 'error' | 'success';
type PauseReason = 'document' | 'focus' | 'hover';

type ToastItem = {
	id: number;
	kind: ToastKind;
	message: string;
	duration: number | null;
	returnFocus?: HTMLElement;
};

type ToastEvent = { type: 'add'; item: ToastItem } | { type: 'dismiss'; id: number };
type ToastListener = (event: ToastEvent) => void;

const listeners = new Set<ToastListener>();
const pendingEvents: ToastEvent[] = [];
let nextId = 1;

function publish(event: ToastEvent): void {
	if (listeners.size === 0) {
		pendingEvents.push(event);
		return;
	}

	for (const listener of listeners) listener(event);
}

function add(kind: ToastKind, message: string): number {
	const id = nextId++;
	const returnFocus = typeof document === 'undefined' ? undefined : document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
	publish({
		type: 'add',
		item: { id, kind, message, duration: kind === 'success' ? SUCCESS_DURATION_MS : null, returnFocus },
	});
	return id;
}

export const toast = {
	success: (message: string) => add('success', message),
	error: (message: string) => add('error', message),
	dismiss: (id: number) => publish({ type: 'dismiss', id }),
};

/** An error whose message has been deliberately approved for user display. */
export class UserFacingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UserFacingError';
	}
}

export function toastError(error: unknown, fallback: string): void {
	toast.error(error instanceof UserFacingError ? error.message : fallback);
}

export function Toaster() {
	const [items, setItems] = createSignal<ToastItem[]>([]);
	const timeouts = new Map<number, ReturnType<typeof setTimeout>>();
	const pauseReasons = new Map<number, Set<PauseReason>>();

	function clearTimer(id: number): void {
		const timeout = timeouts.get(id);
		if (timeout) clearTimeout(timeout);
		timeouts.delete(id);
	}

	function dismiss(id: number): void {
		const item = items().find((candidate) => candidate.id === id);
		const element = document.querySelector<HTMLElement>(`[data-toast-id="${id}"]`);
		const shouldRestoreFocus = !!element?.contains(document.activeElement);

		clearTimer(id);
		pauseReasons.delete(id);
		setItems((current) => current.filter((candidate) => candidate.id !== id));

		if (shouldRestoreFocus && item?.returnFocus?.isConnected) queueMicrotask(() => item.returnFocus?.focus());
	}

	function schedule(item: ToastItem): void {
		clearTimer(item.id);
		if (item.duration === null || pauseReasons.get(item.id)?.size || document.hidden) return;
		timeouts.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
	}

	function pause(item: ToastItem, reason: PauseReason): void {
		const reasons = pauseReasons.get(item.id) ?? new Set<PauseReason>();
		reasons.add(reason);
		pauseReasons.set(item.id, reasons);
		clearTimer(item.id);
	}

	function resume(item: ToastItem, reason: PauseReason): void {
		const reasons = pauseReasons.get(item.id);
		reasons?.delete(reason);
		if (reasons?.size === 0) pauseReasons.delete(item.id);
		schedule(item);
	}

	function appendWithinCapacity(current: ToastItem[], incoming: ToastItem): ToastItem[] {
		const next = [...current, incoming];
		if (next.length <= MAX_TOASTS) return next;

		const focusedToast = document.activeElement?.closest<HTMLElement>('[data-toast-id]');
		const focusedId = Number(focusedToast?.dataset['toastId']);
		const removed =
			current.find((item) => item.id !== focusedId && item.kind === 'success') ?? current.find((item) => item.id !== focusedId);
		if (!removed) return next;

		clearTimer(removed.id);
		pauseReasons.delete(removed.id);
		return next.filter((item) => item.id !== removed.id);
	}

	onSettled(() => {
		const listener: ToastListener = (event) => {
			if (event.type === 'dismiss') {
				dismiss(event.id);
				return;
			}

			setItems((current) => appendWithinCapacity(current, event.item));
			schedule(event.item);
		};
		const handleVisibilityChange = () => {
			for (const item of untrack(items)) {
				if (document.hidden) pause(item, 'document');
				else resume(item, 'document');
			}
		};

		listeners.add(listener);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		for (const event of pendingEvents.splice(0)) listener(event);

		// eslint-disable-next-line solid/reactivity -- onSettled consumes this function as lifecycle cleanup.
		return () => {
			listeners.delete(listener);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			for (const timeout of timeouts.values()) clearTimeout(timeout);
			timeouts.clear();
			pauseReasons.clear();
		};
	});

	return (
		<div class="toast-region" role="region" aria-label="Notifications">
			<For each={items()}>
				{(item) => (
					<div
						class={`app-toast app-toast--${item.kind}`}
						role={item.kind === 'error' ? 'alert' : 'status'}
						data-toast-id={item.id}
						onPointerEnter={() => pause(item, 'hover')}
						onPointerLeave={() => resume(item, 'hover')}
						onFocusIn={() => pause(item, 'focus')}
						onFocusOut={(event) => {
							const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
							if (!event.currentTarget.contains(nextTarget)) resume(item, 'focus');
						}}
					>
						<p>{item.message}</p>
						<button
							type="button"
							aria-label={`Dismiss ${item.kind} notification: ${item.message}`}
							onClick={() => toast.dismiss(item.id)}
						>
							×
						</button>
					</div>
				)}
			</For>
		</div>
	);
}
