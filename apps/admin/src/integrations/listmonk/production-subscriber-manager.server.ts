import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkSubscriberManager } from './subscriber-manager.server';

export const productionSubscriberManager = createListmonkSubscriberManager(productionConfig);
