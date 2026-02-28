<svelte:head>
	<title>FarkPG – Tabletop RPG</title>
	<meta name="description" content="FarkPG is a rules-lite tabletop RPG that uses Farkle dice for resolution. Find rules and build characters here." />
</svelte:head>

<div class="home">
	<h1 class="home-title">FarkPG</h1>
	<p class="home-tagline">A rules-lite tabletop RPG built around Farkle.</p>

	<section class="home-section">
		<h2>What is FarkPG?</h2>
		<p>
			FarkPG is a custom tabletop RPG system that uses <strong>Farkle</strong> as its core resolution mechanic. When your character attempts an action, you roll dice based on your <strong>attributes and skills</strong>—the better your stats, the more dice you roll. You can also spend points on <strong>abilities</strong> to gain special traits. The system is designed to stay <strong>rules lite</strong> and <strong>flexible</strong>, so you can adapt it to different settings and styles of play.
		</p>
	</section>

	<section class="home-section">
		<h2>What's on this site?</h2>
		<p>
			This site gives you everything you need to play:
		</p>
		<ul class="home-links">
			<li><a href="/rules">Game rules</a> — How Farkle resolution works, combat, resources, and more.</li>
			<li><a href="/builders">Character builders</a> — Point-buy character creation for different themes and settings. Each builder shares the same core but can offer different attributes, skills, and abilities.</li>
		</ul>
	</section>

	<section class="home-section">
		<h2>Get started</h2>
		<p>
			Read the <a href="/rules">rules</a> to learn the system, then use a <a href="/builders">character builder</a> to create your first character.
		</p>
	</section>
</div>

<style>
	.home {
		max-width: 42rem;
	}

	.home-title {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
	}

	.home-tagline {
		font-size: 1.125rem;
		color: var(--muted, #555);
		margin: 0 0 2rem 0;
	}

	.home-section {
		margin-bottom: 2rem;
	}

	.home-section h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
	}

	.home-section p {
		margin: 0 0 0.75rem 0;
		line-height: 1.6;
	}

	.home-section p:last-child {
		margin-bottom: 0;
	}

	.home-links {
		margin: 0;
		padding-left: 1.25rem;
		line-height: 1.7;
	}

	.home-links li {
		margin-bottom: 0.5rem;
	}

	.home-links a {
		color: #0066cc;
		text-decoration: none;
	}

	.home-links a:hover {
		text-decoration: underline;
	}
</style>
