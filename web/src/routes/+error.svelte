<script>
  import { base } from '$app/paths';
  export let status;
  export let error;
</script>

<svelte:head>
  <title>{status === 404 ? 'Not found' : 'Error'} – FarkPG</title>
</svelte:head>

<div class="card">
  <h1>{status === 404 ? 'Page not found' : `Error ${status}`}</h1>
  <p class="subtitle">
    {status === 404
      ? "This page doesn't exist."
      : (typeof error === 'object' && error?.message) || error || 'Something went wrong.'}
  </p>
  <a href="{base}/">Back to home</a>
</div>
