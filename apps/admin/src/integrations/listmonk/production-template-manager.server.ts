import 'server-only';
import { productionConfig } from '~/platform/config/production-env.server';
import { createListmonkTemplateManager } from './template-manager.server';

export const productionEmailTemplateManager = createListmonkTemplateManager(productionConfig);
