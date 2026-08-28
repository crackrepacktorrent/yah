import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createUmamiAnalyticsReader } from './analytics-reader.server';

/** Process-local token state is intentionally shared by every analytics query. */
export const productionUmamiAnalyticsReader = createUmamiAnalyticsReader(productionConfig);
