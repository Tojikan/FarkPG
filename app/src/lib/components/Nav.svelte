<script lang="ts">
	const navLinks = [
		{ href: '/', label: 'Home' },
		{ href: '/campaigns', label: 'Dashboard' }
	];

	let { session } = $props();

	let open = $state(false);

	function close() {
		open = false;
	}
</script>

<header class="sticky top-0 z-50 w-full bg-black text-white">
	<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
		<a href="/" class="text-xl font-bold no-underline hover:underline" onclick={close}>FarkPG Sheets</a>

		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center md:hidden"
			aria-expanded={open}
			aria-label={open ? 'Close menu' : 'Open menu'}
			onclick={() => (open = !open)}
		>
			{open ? '✕' : '☰'}
		</button>

		<nav class="w-full md:w-auto" class:hidden={!open} class:md:block={true}>
			<ul class="flex flex-col gap-1 md:flex-row md:items-center">
				{#each navLinks as link}
					<li>
						<a href={link.href} class="block px-3 py-2 hover:underline" onclick={close}>{link.label}</a>
					</li>
				{/each}
				{#if session}
					<li>
						<form method="POST" action="/logout">
							<button type="submit" class="block px-3 py-2 hover:underline">Log out</button>
						</form>
					</li>
				{:else}
					<li><a href="/login" class="block px-3 py-2 hover:underline" onclick={close}>Log in</a></li>
				{/if}
			</ul>
		</nav>
	</div>
</header>
