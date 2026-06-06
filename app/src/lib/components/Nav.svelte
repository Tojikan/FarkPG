<script lang="ts">
	const navLinks = [
		{ href: '/', label: 'Home', icon: 'fa-solid fa-house' },
		{ href: '/campaigns', label: 'Dashboard', icon: 'fa-solid fa-table-cells-large' }
	];

	let { session, activePath = '' } = $props();

	let open = $state(false);

	function close() {
		open = false;
	}

	function isActive(href: string): boolean {
		if (href === '/') return activePath === '/';
		return activePath === href || activePath.startsWith(`${href}/`);
	}
</script>

<header class="site-header">
	<div class="header-inner">
		<a href="/" class="brand" onclick={close}>FarkPG Sheets</a>

		<button
			type="button"
			class="menu-toggle"
			aria-expanded={open}
			aria-label={open ? 'Close menu' : 'Open menu'}
			onclick={() => (open = !open)}
		>
			<i class="fa-solid {open ? 'fa-xmark' : 'fa-bars'}" aria-hidden="true"></i>
		</button>

		<nav class="site-nav" class:site-nav-open={open}>
			<ul class="nav-list">
				{#each navLinks as link}
					<li>
						<a
							href={link.href}
							class="nav-link"
							class:nav-link-active={isActive(link.href)}
							onclick={close}
						>
							<i class={link.icon} aria-hidden="true"></i>
							{link.label}
						</a>
					</li>
				{/each}
				{#if session}
					<li>
						<form method="POST" action="/logout">
							<button type="submit" class="nav-link nav-button">
								<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
								Log out
							</button>
						</form>
					</li>
				{:else}
					<li>
						<a href="/login" class="nav-link" onclick={close}>
							<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
							Log in
						</a>
					</li>
				{/if}
			</ul>
		</nav>
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: #0a0e14;
		border-bottom: 1px solid #1e2736;
	}

	.header-inner {
		max-width: 80rem;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
	}

	.brand {
		font-size: 1.15rem;
		font-weight: 700;
		color: #fff;
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	.menu-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		color: #c5d0dc;
		cursor: pointer;
	}

	.site-nav {
		display: none;
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #0a0e14;
		border-bottom: 1px solid #1e2736;
		padding: 0.5rem 1rem 1rem;
	}

	.site-nav-open {
		display: block;
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.75rem;
		color: #8899aa;
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 500;
		border-radius: 0.375rem;
		border: none;
		background: none;
		cursor: pointer;
		width: 100%;
	}

	.nav-link:hover {
		color: #e8ecf1;
		background: #141b26;
	}

	.nav-link-active {
		color: #c9a227;
		box-shadow: inset 0 -2px 0 #c9a227;
		border-radius: 0;
	}

	.nav-button {
		font: inherit;
		text-align: left;
	}

	@media (min-width: 768px) {
		.menu-toggle {
			display: none;
		}

		.site-nav {
			display: block;
			position: static;
			border: none;
			padding: 0;
			background: transparent;
		}

		.nav-list {
			flex-direction: row;
			align-items: center;
			gap: 0.15rem;
		}

		.nav-link {
			width: auto;
		}

		.nav-button {
			text-align: center;
		}
	}
</style>
