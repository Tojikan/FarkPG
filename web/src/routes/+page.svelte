<script>
  let count = 0;
  let name = 'Adventurer';
</script>

<svelte:head>
  <title>FarkPG – SvelteKit demo</title>
</svelte:head>

<main class="card">
  <h1>FarkPG – SvelteKit demo</h1>
  <p class="subtitle">
    This page is built with SvelteKit (static adapter) and deployed to GitHub Pages via a custom Action.
  </p>

  <div class="demo-section">
    <h2>1. Reactivity (counter)</h2>
    <p>
      <button on:click={() => count += 1}>Count is {count}</button>
    </p>
    <p>Click the button — the number updates without a full page reload.</p>
  </div>

  <div class="demo-section">
    <h2>2. Two-way binding</h2>
    <label class="label" for="name">Character name</label>
    <input id="name" type="text" bind:value={name} placeholder="Enter a name" />
    <p>Hello, <strong>{name || '...'}</strong>!</p>
  </div>

  <p class="footer">
    Edit <code>web/src/routes/+page.svelte</code> and run <code>npm run dev</code> to see changes.
    Push to the repo to trigger the GitHub Action and update the live site.
  </p>
</main>
