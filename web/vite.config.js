import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves at https://<user>.github.io/FarkPG/
const base = process.env.GITHUB_PAGES === 'true' ? '/FarkPG/' : '/';

export default defineConfig({
  base,
  plugins: [svelte()],
});
