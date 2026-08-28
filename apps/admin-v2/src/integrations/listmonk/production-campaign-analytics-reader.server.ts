import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkCampaignAnalyticsReader } from './campaign-analytics-reader.server';

export const productionCampaignAnalyticsReader = createListmonkCampaignAnalyticsReader(productionConfig);
