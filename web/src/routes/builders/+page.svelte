<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Character builders – FarkPG</title>
</svelte:head>

<div class="builders-page">
	<h1>Character builders</h1>
	<p class="lead">Pick a theme to create a character. Each builder uses the same point-buy core with different attributes, skills, and abilities.</p>

	<ul class="builder-list">
		<li>
			<a href="{base}/builders/basic" class="builder-card">
				<span class="builder-name">Basic (multi-setting)</span>
				<span class="builder-desc">Strength, Perception, Intelligence, Dexterity, Endurance, Rizz. Fate as resource. Combat, Adventuring, Social, Knowledge, and General skills.</span>
			</a>
		</li>
		<li>
			<a href="{base}/builders/cyberpunk" class="builder-card">
				<span class="builder-name">Neon City (cyberpunk)</span>
				<span class="builder-desc">Same core stats with Luck instead of Fate. Combat, Technology, Street, and Social skills. Abilities and enhancements share one point pool.</span>
			</a>
		</li>
	</ul>
</div>

<style>
	.builders-page {
		max-width: 42rem;
	}
	.lead {
		color: var(--muted, #555);
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}
	.builder-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.builder-card {
		display: block;
		padding: 1rem 1.25rem;
		background: #f5f5f5;
		border-radius: 8px;
		color: inherit;
		text-decoration: none;
		border: 1px solid #e5e5e5;
	}
	.builder-card:hover {
		background: #eee;
		border-color: #ccc;
	}
	.builder-name {
		font-weight: 600;
		display: block;
		margin-bottom: 0.25rem;
	}
	.builder-desc {
		font-size: 0.9rem;
		color: var(--muted, #555);
		line-height: 1.4;
	}
</style>
