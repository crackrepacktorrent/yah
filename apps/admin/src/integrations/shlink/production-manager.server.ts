import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createShlinkShortlinkManager } from './shortlink-manager.server';

export const productionShlinkShortlinkManager = createShlinkShortlinkManager(productionConfig);
