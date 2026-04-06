import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const lang = event.params.lang === 'es' ? 'es' : 'en';

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${lang}"`)
  });
};
