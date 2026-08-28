import 'server-only';
import { env } from 'virtual:env/server';
import { parseProductionConfig } from './production';

if (env.ADMIN_RUNTIME !== 'production') {
	throw new Error('Production configuration was loaded outside production mode.');
}

/** Synchronously fail startup before any database or auth work begins. */
export const productionConfig = parseProductionConfig(env);
