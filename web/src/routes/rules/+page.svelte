
<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Rules – FarkPG</title>
	<meta
		name="description"
		content="FarkPG rules covering Farkrolls, Fast Rolls, combat, resources, attributes, skills, and character creation."
	/>
</svelte:head>

<div class="rules-page">
	<h1 class="rules-title">Game Rules</h1>

	<p class="rules-intro">
		FarkPG is a fast, flexible tabletop RPG built around risk, momentum, and resource management.
	</p>

	<section class="rules-section">
		<h2>Farkrolls</h2>

		<p>
			A <strong>Farkroll</strong> is the main resolution mechanic. Roll dice using standard
			Farkle rules whenever your character attempts something important.
		</p>

		<ul>
			<li>
				<strong>Dice Rolled:</strong> Attribute + Skill = number of dice rolled.
			</li>
			<li>
				<strong>Maximum Dice:</strong> You can never roll more than 6 dice.
			</li>
			<li>
				<strong>Free Re-rolls:</strong> Each dice rolled over 6 grants 1 free re-roll applied anytime during the roll. It's a single free re-roll of one dice.
			</li>
			<li>
				<strong>Busting:</strong> If a roll scores nothing on first roll, the Farkroll fails no matter what.
			</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Fast Rolls</h2>

		<p>
			For quick or less important actions, use a <strong>Fast Roll</strong> instead of a
			Farkroll.
		</p>

		<ul>
			<li>
				Roll <strong>1d20 + Attribute + Skill</strong>.
			</li>
			<li>
				The GM sets the difficulty or compares results directly.
			</li>
			<li>
				Fast Rolls are quicker, but less dramatic than Farkrolls.
			</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Resource Currency</h2>

		<p>
			Resource currency lets players push through bad luck during a Farkroll.
		</p>

		<ul>
			<li>
				Declare that you are using currency prior to starting a Farkroll
			</li>
			<li>
				Spend <strong>1 currency</strong> before each time you roll dice. 
			</li>
			<li>
				If you bust, you keep any points already banked during that Farkroll.
			</li>
			<li>
				The currency must be declared before rolling.
			</li>
			<li>
				Some themes or currencies may grant additional effects beyond protection from busting.
			</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Combat</h2>

		<ul>
			<li>
				Each character gets <strong>2 actions</strong> per turn.
			</li>
			<li>
				Actions are flexible and may be repeated.
			</li>
			<li>
				Free re-rolls only apply for the entire turn, not per action. Repeated actions thus only get free re-rolls once.
			</li>
			<li>
				Initiative may be stat-based or rolled depending on the theme.
			</li>
		</ul>
	</section>

	<section class="rules-section">
		<h2>Attributes & Skills</h2>

		<p>
			Attributes are core stats like Strength, Agility, Intelligence, or Willpower.
			Skills represent trained abilities such as Combat, Stealth, Medicine, or Persuasion.
		</p>

		<p>
			Most rolls use an Attribute + Skill combination chosen by the GM or theme.
		</p>
	</section>

	<section class="rules-section">
		<h2>Abilities</h2>

		<p>
			Abilities are special traits, perks, or powers purchased during character creation.
			Some are one-time purchases, while others can be upgraded in ranks.
		</p>
	</section>

	<section class="rules-section">
		<h2>Experience (XP)</h2>

		<p>
			XP is used for character growth, rewards, and progression as defined by the campaign or theme.
		</p>
	</section>

	<section class="rules-section">
		<h2>Character Creation</h2>

		<p>
			FarkPG uses a point-buy system. Players spend points on attributes, skills, and abilities.
		</p>

		<p>
			Some themes may include custom skills, custom abilities, or additional character options.
			Use the <a href="{base}/builders">character builders</a> to create and save characters.
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
```
