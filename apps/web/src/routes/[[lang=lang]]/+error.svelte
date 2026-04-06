<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{page.status === 404 ? 'This page doesn\'t exist.' : 'Something went wrong.'}</p>
  <a href="/">Go home</a>
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
