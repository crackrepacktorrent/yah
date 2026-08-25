<script lang="ts">
  import { page } from '$app/state';

  let isSpanish = $derived(page.params.lang === 'es');
  let notFound = $derived(page.status === 404);
  let title = $derived(
    isSpanish
      ? (notFound ? 'Página no encontrada' : 'Error del sitio')
      : (notFound ? 'Page not found' : 'Site error')
  );
  let message = $derived(
    isSpanish
      ? (notFound ? 'Esta página no existe.' : 'Algo salió mal. Inténtalo de nuevo más tarde.')
      : (notFound ? 'This page does not exist.' : 'Something went wrong. Please try again later.')
  );
  let homeHref = $derived(isSpanish ? '/es' : '/');
</script>

<svelte:head>
  <title>{title} | Youth Alliance for Housing</title>
  <meta name="robots" content="noindex,nofollow,noarchive" />
</svelte:head>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{message}</p>
  <a href={homeHref}>{isSpanish ? 'Ir al inicio' : 'Go home'}</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    gap: 1rem;
  }

  h1 {
    font-size: 4rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-primary-foreground);
  }

  p {
    font-size: 1.125rem;
    color: var(--color-primary-foreground);
    margin: 0;
  }

  a {
    color: var(--color-primary-foreground);
    text-decoration: underline;
    font-weight: 600;
  }
</style>
