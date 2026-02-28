<svelte:head>
	<title>Rules – FarkPG</title>
	<meta name="description" content="FarkPG game rules: Farkle resolution, dice, combat, resources, attributes, skills, and abilities." />
</svelte:head>

<div class="rules-page">
	<h1 class="rules-title">Game rules</h1>
	<p class="rules-intro">How FarkPG works at the table. The system is rules lite and flexible—themes and settings can adjust details.</p>

	<section class="rules-section">
		<h2>Core resolution: Farkle</h2>
		<p>
			<strong>Farkle</strong> is the core resolution mechanic. When your character attempts an action, you roll dice using standard Farkle rules. The number of dice you roll is determined by your <strong>attributes + skills</strong> for that action (as defined by the theme and your character).
		</p>
		<ul>
			<li><strong>Max dice rolled is always 6.</strong> If your attribute + skill total would give more than 6 dice, you still only roll 6.</li>
			<li>Each point over 6 gives you <strong>1 free re-roll</strong> during that Farkle roll. When you can use these re-rolls depends on context (e.g. in combat they last the whole turn—see Combat).</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Resource currency</h2>
		<p>
			The game uses a <strong>resource currency</strong> so players can attempt Farkle without losing progress when a roll fails. Before a Farkle roll, a player may declare they are spending the resource. For that roll, they spend <strong>1 currency per roll</strong> to <strong>retain rolled values</strong>—if they bust, they don’t lose the points they’d already banked. The decision to use the resource must be declared at the <strong>start of that Farkle roll</strong>; each roll that uses this protection consumes 1 resource.
		</p>
	</section>

	<section class="rules-section">
		<h2>Combat</h2>
		<ul>
			<li><strong>Initiative:</strong> Combat uses a simple initiative system (e.g. roll or stat-based order).</li>
			<li><strong>Actions:</strong> Each player has <strong>2 actions</strong> per turn. Actions are flexible and can be repeated.</li>
			<li><strong>Free re-rolls:</strong> Free re-rolls from attributes + skills (values over 6) last through the <strong>whole turn</strong>, not per action.</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Attributes and skills</h2>
		<p>
			<strong>Attributes</strong> are core stats (e.g. Strength, Agility, Endurance, Intelligence, Willpower, Charisma). They have numeric values and usually min/max/default bounds. <strong>Skills</strong> are grouped by category (e.g. Combat, Social, Knowledge). Each skill can be tied to an attribute and has a numeric value. Your attribute + the relevant skill (or the method defined by the theme) determines how many dice you roll for that action.
		</p>
	</section>

	<section class="rules-section">
		<h2>Abilities</h2>
		<p>
			<strong>Abilities</strong> are special traits you buy during character creation. They can be one-off (bought once) or levelable (multiple ranks). Each ability has a cost in character-building points. Use the <a href="/builders">character builders</a> to assign points and choose abilities.
		</p>
	</section>

	<section class="rules-section">
		<h2>Experience (XP)</h2>
		<p>
			Characters have an <strong>XP</strong> (experience) value. It’s used for advancement, unlocks, or other rewards as defined by the theme or campaign.
		</p>
	</section>

	<section class="rules-section">
		<h2>Character building</h2>
		<p>
			Character building is a <strong>point buy system</strong>. You spend points from defined pools to set attribute values, skill values, and abilities. Each theme defines the pools and limits (e.g. total attribute points, points per skill category, ability points). Some themes allow <strong>custom skills</strong> (your own skill name and value in a category) and <strong>custom abilities</strong>. Use a <a href="/builders">character builder</a> to create and save characters.
		</p>
	</section>
</div>

<style>
	.rules-page {
		max-width: 42rem;
	}

	.rules-title {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
	}

	.rules-intro {
		color: var(--muted, #555);
		margin: 0 0 2rem 0;
		line-height: 1.5;
	}

	.rules-section {
		margin-bottom: 2rem;
	}

	.rules-section h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
	}

	.rules-section p,
	.rules-section ul {
		margin: 0 0 0.75rem 0;
		line-height: 1.6;
	}

	.rules-section ul {
		padding-left: 1.25rem;
	}

	.rules-section li {
		margin-bottom: 0.35rem;
	}

	.rules-section a {
		color: #0066cc;
		text-decoration: none;
	}

	.rules-section a:hover {
		text-decoration: underline;
	}
</style>
