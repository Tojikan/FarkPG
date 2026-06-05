<script lang="ts">
	import '../routes/layout.css';
	import Nav from '$lib/components/Nav.svelte';

	let { data, children } = $props();
</script>

<Nav session={data.session} />
<main>{@render children()}</main>
