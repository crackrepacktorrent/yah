import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkCampaignTestSender } from './campaign-test-sender.server';

export const productionCampaignTestSender = createListmonkCampaignTestSender(productionConfig);
