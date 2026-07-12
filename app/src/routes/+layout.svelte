<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children, data } = $props();

	const isPlayerView = $derived(
		page.url.pathname.startsWith('/join') || page.url.pathname.startsWith('/sheet')
	);
</script>

<svelte:head>
	<title>FarkPG</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-edge bg-surface/60">
		<div class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
			<a href={data.session ? '/' : '/join'} class="font-display text-lg font-bold tracking-wide text-accent">
				FarkPG
			</a>
			<nav class="flex items-center gap-4 text-sm">
				<a href="/dice" class="text-muted hover:text-ink">Dice Roller</a>
				{#if data.session && !isPlayerView}
					<a href="/" class="text-muted hover:text-ink">Campaigns</a>
					<span class="hidden text-muted/60 sm:inline">{data.userEmail}</span>
					<form method="POST" action="/logout">
						<button type="submit" class="text-muted hover:text-danger">Log out</button>
					</form>
				{/if}
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
		{@render children()}
	</main>
</div>
