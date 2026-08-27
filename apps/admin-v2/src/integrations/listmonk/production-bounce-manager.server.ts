import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkBounceManager } from './bounce-manager.server';

export const productionBounceManager = createListmonkBounceManager(productionConfig);
