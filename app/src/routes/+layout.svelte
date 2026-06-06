<script lang="ts">
	import '../routes/layout.css';
	import Nav from '$lib/components/Nav.svelte';
	import { page } from '$app/state';

	let { data, children } = $props();
</script>

<Nav session={data.session} activePath={page.url.pathname} />
<main
	class:main-full={page.url.pathname.startsWith('/campaigns') ||
		page.url.pathname.startsWith('/characters')}
>{@render children()}</main>

<style>
	:global(main.main-full) {
		max-width: none;
		padding: 0;
		background: #0a0e14;
		min-height: calc(100vh - 3.5rem);
	}
</style>
