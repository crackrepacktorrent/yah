import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkMailingListManager } from './mailing-list-manager.server';

export const productionMailingListManager = createListmonkMailingListManager(productionConfig);
