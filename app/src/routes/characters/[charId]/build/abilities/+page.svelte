<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import BuildShell from '$lib/components/builder/BuildShell.svelte';
	import { BUILD_CTX, saveBuild, setBuildSheetData, type BuildStore } from '$lib/build/context';
	import { abilityIconClass } from '$lib/data/abilityIcons';
	import type { AbilityDef } from '$lib/data/types';

	const build = getContext<BuildStore>(BUILD_CTX);

	function selectedId(): string | null {
		for (const ab of build.theme.abilities) {
			if ((build.sheetData.abilities[ab.id] ?? 0) > 0) return ab.id;
		}
		return null;
	}

	function selectAbility(ab: AbilityDef) {
		const map: Record<string, number> = {};
		for (const item of build.theme.abilities) {
			map[item.id] = item.id === ab.id ? 1 : 0;
		}
		setBuildSheetData(build, { ...build.sheetData, abilities: map });
	}

	async function goBack() {
		await saveBuild(build);
		goto(`/characters/${build.characterId}/build/skills?category=mind`);
	}

	async function finishBuild() {
		await saveBuild(build, { builderComplete: true });
		goto(`/characters/${build.characterId}`);
	}
</script>

<BuildShell currentStep="abilities">
	<div class="step-page">
		<div class="step-header">
			<h1 class="step-title">{build.characterName || 'Create New Character'}</h1>
			<h2 class="step-subtitle">3. Select a Starting Ability</h2>
			<p class="step-desc">Choose one starting ability for your character.</p>
		</div>

		<ul class="ability-list" role="radiogroup" aria-label="Starting ability">
			{#each build.theme.abilities as ab}
				{@const taken = selectedId() === ab.id}
				{@const icon = ab.icon ?? abilityIconClass(ab.id)}
				<li>
					<button
						type="button"
						role="radio"
						class="ability-card"
						class:ability-card-selected={taken}
						aria-checked={taken}
						onclick={() => selectAbility(ab)}
					>
						<div class="ability-icon-wrap" aria-hidden="true">
							<i class={icon}></i>
						</div>
						<div class="ability-content">
							<span class="ability-name">{ab.label}</span>
							<p class="ability-desc">{ab.description}</p>
							{#if ab.details?.length}
								<ul class="ability-details">
									{#each ab.details as detail}
										<li>{detail}</li>
									{/each}
								</ul>
							{/if}
						</div>
						<span class="ability-radio" aria-hidden="true"></span>
					</button>
				</li>
			{/each}
		</ul>
	</div>

	{#snippet footer()}
		<button type="button" class="btn-back" onclick={goBack}>
			<span aria-hidden="true">←</span> Back to Skills: Mind
		</button>
		<button type="button" class="btn-continue" disabled={selectedId() == null} onclick={finishBuild}>
			Finish Build <span aria-hidden="true">→</span>
		</button>
	{/snippet}
</BuildShell>

<style>
	.step-page {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.step-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.step-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.75rem;
		font-weight: 700;
		color: #e8ecf1;
		margin-bottom: 0.5rem;
	}

	.step-subtitle {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: #c5d0dc;
		margin-bottom: 0.5rem;
	}

	.step-desc {
		max-width: 32rem;
		font-size: 0.9rem;
		color: #8899aa;
		line-height: 1.5;
		margin: 0;
	}

	.ability-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 900px) {
		.ability-list {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.ability-card {
		display: grid;
		grid-template-columns: auto 1fr auto;
		width: 100%;
		align-items: start;
		gap: 1.25rem;
		padding: 1.5rem;
		min-height: 12rem;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
		background: #1a2332;
		text-align: left;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
		color: #e8ecf1;
		transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
	}

	.ability-card:hover {
		border-color: #3a4d66;
		background: #1e2736;
	}

	.ability-card-selected {
		border-color: #5dade2;
		background: rgba(93, 173, 226, 0.08);
		box-shadow: inset 0 0 0 1px #5dade2;
	}

	.ability-icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.75rem;
		height: 3.75rem;
		border-radius: 0.75rem;
		background: rgba(93, 173, 226, 0.12);
		border: 1px solid rgba(93, 173, 226, 0.25);
		color: #5dade2;
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.ability-card-selected .ability-icon-wrap {
		background: rgba(93, 173, 226, 0.2);
		border-color: #5dade2;
		color: #7ec0ea;
	}

	.ability-content {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-width: 0;
	}

	.ability-name {
		font-size: 1.125rem;
		font-weight: 700;
		color: #e8ecf1;
		line-height: 1.3;
	}

	.ability-desc {
		font-size: 0.875rem;
		color: #c5d0dc;
		line-height: 1.55;
		margin: 0;
	}

	.ability-details {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ability-details li {
		font-size: 0.8125rem;
		color: #8899aa;
		line-height: 1.5;
	}

	.ability-radio {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.25rem;
		border: 2px solid #3a4d66;
		border-radius: 9999px;
	}

	.ability-card-selected .ability-radio {
		border-color: #5dade2;
		background: radial-gradient(circle at center, #5dade2 0 35%, transparent 36%);
	}

	.btn-back {
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

	.btn-back:hover {
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
</style>
