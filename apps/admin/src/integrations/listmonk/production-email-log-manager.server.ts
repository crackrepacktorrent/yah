import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkEmailLogManager } from './email-log-manager.server';

export const productionEmailLogManager = createListmonkEmailLogManager(productionConfig);
