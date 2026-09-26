import { revalidate } from '@solidjs/router';
import { onCleanup } from 'solid-js';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import type { SaveEmailSettingsResult } from './contracts';

/** Keep provider reload timing and feedback consistent across settings sections. */
export function createEmailSettingsSave<Command>(options: {
	save: (command: Command) => Promise<SaveEmailSettingsResult>;
	queryKey: string | string[];
	savedMessage: string;
	failureMessage: string;
}) {
	const task = createCommandTask();
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let refreshNeeded = false;
	let disposed = false;

	function refresh(): void {
		refreshTimer = undefined;
		refreshNeeded = false;
		revalidate(options.queryKey);
	}

	onCleanup(() => {
		disposed = true;
		if (refreshTimer !== undefined) clearTimeout(refreshTimer);
		if (refreshNeeded) {
			// Leaving early must still invalidate the cache for the next visit.
			refresh();
		}
	});

	function save(command: Command): Promise<boolean> {
		return task.run(async () => {
			if (refreshTimer !== undefined) clearTimeout(refreshTimer);
			refreshTimer = undefined;
			try {
				const result = await options.save(command);
				refreshNeeded = true;
				toast.success(`${options.savedMessage} ${result.needsRestart
					? 'Listmonk will reload after active campaigns finish.'
					: 'Listmonk is reloading and may be briefly unavailable.'}`);
			} finally {
				// Give Listmonk time to reload after the latest save settles.
				if (refreshNeeded) {
					if (disposed) refresh();
					else refreshTimer = setTimeout(refresh, 2_000);
				}
			}
		}, options.failureMessage);
	}

	return { ...task, save };
}
