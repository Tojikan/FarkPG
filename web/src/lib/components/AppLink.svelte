<script lang="ts">
	import { base } from '$app/paths';

	/** Path (e.g. /builders). Base path is prepended automatically for GitHub Pages etc. */
	let { href = '', class: className = '', ...rest } = $props();
	const resolved = href.startsWith('http') || href.startsWith('//') ? href : base + href;
</script>

<a href={resolved} class={className} {...rest}>
	{@render children?.()}
</a>
