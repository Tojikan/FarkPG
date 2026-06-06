<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import BuildShell from '$lib/components/builder/BuildShell.svelte';
	import AttributeCategoryIcon from '$lib/components/builder/AttributeCategoryIcon.svelte';
	import { BUILD_CTX, saveBuild, setBuildCharacterName, setBuildSheetData, type BuildStore } from '$lib/build/context';
	import { cloneSheetData, getAttributeMax, getHealthMax, getRemainingAttributePoints, getSpentAttributePoints } from '$lib/data/character';
	import { getActionPointsMax, getMovement } from '$lib/data/themes/core';

	const build = getContext<BuildStore>(BUILD_CTX);

	const pool = $derived(build.theme.points.attributes);
	const spent = $derived(getSpentAttributePoints(build.sheetData, build.theme));
	const remaining = $derived(getRemainingAttributePoints(build.sheetData, build.theme));

	const body = $derived(build.sheetData.attributes.body ?? 1);
	const adroit = $derived(build.sheetData.attributes.adroit ?? 1);
	const mind = $derived(build.sheetData.attributes.mind ?? 1);
	const maxHp = $derived(getHealthMax(build.sheetData, build.theme));
	const maxAp = $derived(getActionPointsMax(build.sheetData.attributes));
	const movement = $derived(getMovement(build.sheetData.attributes));

	const attrStyles: Record<string, { accent: string; bg: string; border: string }> = {
		body: { accent: '#e74c3c', bg: 'rgba(231, 76, 60, 0.12)', border: '#e74c3c' },
		adroit: { accent: '#2ecc71', bg: 'rgba(46, 204, 113, 0.12)', border: '#2ecc71' },
		mind: { accent: '#3498db', bg: 'rgba(52, 152, 219, 0.12)', border: '#3498db' }
	};

	function bumpAttribute(id: string, delta: number) {
		const attr = build.theme.attributes.find((a) => a.id === id);
		if (!attr) return;
		const current = build.sheetData.attributes[id] ?? attr.default;
		const maxForAttr = getAttributeMax(build.sheetData, build.theme, id);
		const next = Math.max(attr.min, Math.min(maxForAttr, current + delta));
		if (next === current) return;
		setBuildSheetData(build, {
			...build.sheetData,
			attributes: { ...build.sheetData.attributes, [id]: next }
		});
	}

	function cancelToDashboard() {
		goto('/campaigns');
	}

	async function continueToSkills() {
		await saveBuild(build);
		goto(`/characters/${build.characterId}/build/skills?category=body`);
	}
</script>

<BuildShell currentStep="attributes">
	<div class="step-page">
		<div class="step-header">
			<div>
				<h1 class="step-title">Create New Character</h1>
				<label class="name-field">
					<span class="sr-only">Character name</span>
					<input
						type="text"
						class="name-input"
						placeholder="Character name"
						value={build.characterName}
						oninput={(e) => setBuildCharacterName(build, e.currentTarget.value)}
					/>
				</label>
				<h2 class="step-subtitle">1. Set Your Attributes</h2>
				<p class="step-desc">
					Set each attribute between 1 and 6. The total of Body, Adroit, and Mind cannot exceed {pool}.
				</p>
			</div>

			<div class="points-card">
				<p class="points-card-label">Points remaining</p>
				<p class="points-card-value">{remaining}</p>
				<div class="points-card-divider" aria-hidden="true"><span>◆</span></div>
				<div class="points-card-total">
					<span>Total points</span>
					<span>{spent} / {pool}</span>
				</div>
			</div>
		</div>

		<div class="attr-grid">
			{#each build.theme.attributes as attr}
				{@const val = build.sheetData.attributes[attr.id] ?? attr.default}
				{@const style = attrStyles[attr.id] ?? attrStyles.body}
				<article class="attr-card" style="--accent: {style.accent}; --card-bg: {style.bg}; --card-border: {style.border}">
					<div class="attr-card-top">
						<div class="attr-icon" aria-hidden="true">
							<AttributeCategoryIcon categoryId={attr.id} class="attr-icon-glyph" />
						</div>
						<h3 class="attr-name">{attr.label}</h3>
						<p class="attr-desc">{attr.description}</p>
					</div>
					<div class="attr-card-controls">
						<button
							type="button"
							class="attr-btn"
							disabled={val <= attr.min}
							onclick={() => bumpAttribute(attr.id, -1)}
							aria-label="Decrease {attr.label}"
						>−</button>
						<span class="attr-value">{val}</span>
						<button
							type="button"
							class="attr-btn"
							disabled={val >= getAttributeMax(build.sheetData, build.theme, attr.id)}
							onclick={() => bumpAttribute(attr.id, 1)}
							aria-label="Increase {attr.label}"
						>+</button>
					</div>
				</article>
			{/each}
		</div>

		<section class="derived-panel" aria-label="Derived stats">
			<h3 class="derived-title">Stats</h3>
			<dl class="derived-list">
				<div class="derived-row">
					<dt>Max HP</dt>
					<dd>
						<span class="derived-value">{maxHp.toLocaleString()}</span>
						<span class="derived-formula">Set by Body {body}</span>
					</dd>
				</div>
				<div class="derived-row">
					<dt>Movement</dt>
					<dd>
						<span class="derived-value">{movement}</span>
						<span class="derived-formula">Set by Adroit {adroit}</span>
					</dd>
				</div>
				<div class="derived-row">
					<dt>Max AP</dt>
					<dd>
						<span class="derived-value">{maxAp}</span>
						<span class="derived-formula">Set by Mind {mind}</span>
					</dd>
				</div>
			</dl>
		</section>
	</div>

	{#snippet footer()}
		<button type="button" class="btn-cancel" onclick={cancelToDashboard}>Cancel</button>
		<button type="button" class="btn-continue" onclick={continueToSkills}>
			Continue to Skills: Body <span aria-hidden="true">→</span>
		</button>
	{/snippet}
</BuildShell>

<style>
	.step-page {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.step-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 2rem;
		align-items: flex-start;
	}

	.step-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 2rem;
		font-weight: 700;
		color: #e8ecf1;
		margin-bottom: 0.75rem;
	}

	.name-field {
		display: block;
		margin-bottom: 1rem;
	}

	.name-input {
		width: 100%;
		max-width: 20rem;
		border: none;
		border-bottom: 1px solid #3a4d66;
		background: transparent;
		padding: 0.35rem 0;
		font-size: 1rem;
		color: #e8ecf1;
	}

	.name-input:focus {
		outline: none;
		border-bottom-color: #5dade2;
	}

	.step-subtitle {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: #c5d0dc;
		margin-bottom: 0.5rem;
	}

	.step-desc {
		max-width: 28rem;
		font-size: 0.9rem;
		color: #8899aa;
		line-height: 1.5;
	}

	.points-card {
		background: #1a2332;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		padding: 1.25rem 1.5rem;
		min-width: 10rem;
		text-align: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.points-card-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #8899aa;
	}

	.points-card-value {
		font-size: 2.5rem;
		font-weight: 700;
		color: #5dade2;
		line-height: 1.2;
		margin: 0.25rem 0;
	}

	.points-card-divider {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.75rem 0;
		color: #3a4d66;
		font-size: 0.5rem;
	}

	.points-card-divider::before,
	.points-card-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #2d3a4d;
	}

	.points-card-total {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #8899aa;
	}

	.attr-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1.25rem;
	}

	.attr-card {
		background: #1a2332;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.attr-card-top {
		padding: 1.25rem 1.25rem 1rem;
	}

	.attr-icon {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--card-bg);
		border: 2px solid var(--card-border);
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}

	:global(.attr-icon-glyph) {
		font-size: 1.1rem;
		color: var(--accent);
	}

	.attr-name {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--accent);
		margin-bottom: 0.35rem;
	}

	.attr-desc {
		font-size: 0.85rem;
		color: #8899aa;
		line-height: 1.4;
	}

	.attr-card-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		padding: 0.85rem 1rem;
		background: var(--card-bg);
		border-top: 1px solid #2d3a4d;
		border-bottom: 3px solid var(--card-border);
	}

	.attr-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.375rem;
		border: 1px solid #3a4d66;
		background: #141b26;
		font-size: 1.25rem;
		line-height: 1;
		color: #e8ecf1;
		cursor: pointer;
	}

	.attr-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.attr-btn:not(:disabled):hover {
		background: #243044;
	}

	.attr-value {
		font-size: 1.5rem;
		font-weight: 700;
		min-width: 1.5rem;
		text-align: center;
		color: #e8ecf1;
	}

	.btn-cancel {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.25rem;
		border: 1px solid #3a4d66;
		border-radius: 0.375rem;
		background: #1a2332;
		font-size: 0.875rem;
		color: #c5d0dc;
		cursor: pointer;
	}

	.btn-cancel:hover {
		background: #243044;
	}

	.btn-continue {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.5rem;
		border: none;
		border-radius: 0.375rem;
		background: #5dade2;
		color: #0a0e14;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-continue:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn-continue:not(:disabled):hover {
		background: #7ec0ea;
	}

	.derived-panel {
		background: #1a2332;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.derived-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #e8ecf1;
		margin-bottom: 0.75rem;
	}

	.derived-list {
		display: grid;
		gap: 0.65rem;
	}

	@media (min-width: 640px) {
		.derived-list {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.derived-row dt {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #8899aa;
		margin-bottom: 0.15rem;
	}

	.derived-value {
		display: block;
		font-size: 1.35rem;
		font-weight: 700;
		color: #e8ecf1;
		line-height: 1.2;
	}

	.derived-formula {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.72rem;
		color: #8899aa;
		line-height: 1.35;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
