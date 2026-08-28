import 'server-only';

import {
	EmailPerformanceSettingsSchema,
	type EmailPerformanceSettings,
	type SaveEmailPerformanceSettingsCommand,
} from '~/features/email-settings/contracts';
import {
	parseListmonkValue,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';

export function projectEmailPerformanceSettings(
	document: ListmonkSettingsDocument,
): EmailPerformanceSettings {
	return parseListmonkValue(EmailPerformanceSettingsSchema, {
		concurrency: document['app.concurrency'],
		messageRate: document['app.message_rate'],
		batchSize: document['app.batch_size'],
		maxSendErrors: document['app.max_send_errors'],
		slidingWindow: document['app.message_sliding_window'],
		slidingWindowRate: document['app.message_sliding_window_rate'],
		slidingWindowDuration: document['app.message_sliding_window_duration'],
		cacheSlowQueries: document['app.cache_slow_queries'],
		cacheSlowQueriesInterval: document['app.cache_slow_queries_interval'],
	}, 'email performance settings');
}

export function applyEmailPerformanceSettingsPatch(
	document: ListmonkSettingsDocument,
	command: SaveEmailPerformanceSettingsCommand,
): void {
	document['app.concurrency'] = command.concurrency;
	document['app.message_rate'] = command.messageRate;
	document['app.batch_size'] = command.batchSize;
	document['app.max_send_errors'] = command.maxSendErrors;
	document['app.message_sliding_window'] = command.slidingWindow;
	document['app.message_sliding_window_rate'] = command.slidingWindowRate;
	document['app.message_sliding_window_duration'] = command.slidingWindowDuration;
	document['app.cache_slow_queries'] = command.cacheSlowQueries;
	document['app.cache_slow_queries_interval'] = command.cacheSlowQueriesInterval;
}
