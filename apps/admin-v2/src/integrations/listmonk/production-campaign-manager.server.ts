import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkCampaignManager } from './campaign-manager.server';

export const productionCampaignManager = createListmonkCampaignManager(productionConfig);
