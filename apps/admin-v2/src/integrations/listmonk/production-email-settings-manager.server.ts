import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkEmailSettingsManager } from './email-settings-manager.server';

export const productionEmailSettingsManager = createListmonkEmailSettingsManager(productionConfig);
