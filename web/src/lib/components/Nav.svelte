<script lang="ts">
	const navLinks = [
		{ href: '/', label: 'Home' },
		{ href: '/rules', label: 'Rules' },
		{ href: '/builders', label: 'Character Builders' }
	];

	let open = $state(false);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}
</script>

<header class="nav-bar">
	<div class="nav-inner">
		<a href="/" class="nav-brand" onclick={close}>FarkPG</a>

		<button
			type="button"
			class="nav-toggle"
			aria-expanded={open}
			aria-label={open ? 'Close menu' : 'Open menu'}
			onclick={toggle}
		>
			<span class="nav-toggle-icon" aria-hidden="true">
				{#if open}
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/></svg>
				{/if}
			</span>
		</button>

		<nav class="nav-menu" class:nav-menu-open={open}>
			<ul class="nav-list">
				{#each navLinks as link}
					<li>
						<a href={link.href} class="nav-link" onclick={close}>{link.label}</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</header>

<style>
	.nav-bar {
		background: #000;
		color: #fff;
		width: 100%;
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		max-width: var(--gutter-max-width);
		margin: 0 auto;
		padding: 0.75rem var(--gutter-padding);
	}

	.nav-brand {
		font-weight: 700;
		font-size: 1.25rem;
		color: inherit;
		text-decoration: none;
	}

	.nav-brand:hover {
		text-decoration: underline;
	}

	.nav-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
	}

	@media (min-width: 768px) {
		.nav-toggle {
			display: none;
		}
	}

	.nav-menu {
		width: 100%;
		max-height: 0;
		overflow: hidden;
		transition: max-height 0.2s ease-out;
	}

	.nav-menu-open {
		max-height: 20rem;
	}

	@media (min-width: 768px) {
		.nav-menu {
			width: auto;
			max-height: none;
			overflow: visible;
		}

		.nav-menu-open {
			max-height: none;
		}
	}

	.nav-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		list-style: none;
		margin: 0;
		padding: 0;
		padding-top: 0.5rem;
	}

	@media (min-width: 768px) {
		.nav-list {
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
			padding-top: 0;
		}
	}

	.nav-link {
		display: block;
		padding: 0.5rem 0.75rem;
		color: inherit;
		text-decoration: none;
	}

	.nav-link:hover {
		text-decoration: underline;
	}

	@media (min-width: 768px) {
		.nav-link {
			display: inline-block;
		}
	}
</style>
