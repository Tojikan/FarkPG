<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BuildShell from '$lib/components/builder/BuildShell.svelte';
	import AttributeCategoryIcon from '$lib/components/builder/AttributeCategoryIcon.svelte';
	import { BUILD_CTX, saveBuild, setBuildSheetData, type BuildStore } from '$lib/build/context';
	import {
		cloneSheetData,
		getCostToRaiseSkill,
		getRemainingSkillPoints,
		getSkillPointsSpentForCategory,
		getSkillPoolForCategory,
		newLineId
	} from '$lib/data/character';
	import { skillIconClass } from '$lib/data/skillIcons';
	import { KNOWLEDGE_PRESETS, SKILL_RANK_CAP, knowledgeLabel } from '$lib/data/themes/core';
	import type { CharacterData, CustomSkillLine, KnowledgeLine } from '$lib/data/types';

	const build = getContext<BuildStore>(BUILD_CTX);

	const CATEGORY_ORDER = ['body', 'adroit', 'mind'] as const;
	type CategoryId = (typeof CATEGORY_ORDER)[number];

	const categoryIntros: Record<CategoryId, string> = {
		body: 'Body measures physical power, strength, and resilience. Skills in this category cover melee combat, athletics, endurance, and surviving punishing physical situations.',
		adroit: 'Adroit reflects agility, reflexes, and manual skill. Skills here include ranged combat, stealth, piloting, crafting, and precise movement under pressure.',
		mind: 'Mind represents knowledge, reasoning, and mental focus. These skills cover investigation, medical expertise, hacking, perception, and specialized fields of study.'
	};

	const tabStyles: Record<string, { accent: string; bg: string; border: string }> = {
		body: { accent: '#e74c3c', bg: 'rgba(231, 76, 60, 0.12)', border: '#e74c3c' },
		adroit: { accent: '#2ecc71', bg: 'rgba(46, 204, 113, 0.12)', border: '#2ecc71' },
		mind: { accent: '#3498db', bg: 'rgba(52, 152, 219, 0.12)', border: '#3498db' }
	};

	const activeCategoryId = $derived.by((): CategoryId => {
		const param = page.url.searchParams.get('category') ?? 'body';
		return CATEGORY_ORDER.includes(param as CategoryId) ? (param as CategoryId) : 'body';
	});

	const categoryIndex = $derived(CATEGORY_ORDER.indexOf(activeCategoryId));
	const previousCategoryId = $derived(
		categoryIndex > 0 ? CATEGORY_ORDER[categoryIndex - 1] : null
	);
	const nextCategoryId = $derived(
		categoryIndex < CATEGORY_ORDER.length - 1 ? CATEGORY_ORDER[categoryIndex + 1] : null
	);

	const categories = $derived(Object.values(build.theme.skills));

	const activeCategory = $derived(
		categories.find((c) => c.id === activeCategoryId) ?? categories[0]
	);

	const activeAttr = $derived(
		build.theme.attributes.find((a) => a.id === activeCategoryId)
	);

	const activeStyle = $derived(tabStyles[activeCategoryId] ?? tabStyles.body);

	const nextCategoryLabel = $derived(
		nextCategoryId
			? (build.theme.attributes.find((a) => a.id === nextCategoryId)?.label ?? nextCategoryId)
			: null
	);

	const previousCategoryLabel = $derived(
		previousCategoryId
			? (build.theme.attributes.find((a) => a.id === previousCategoryId)?.label ?? previousCategoryId)
			: null
	);

	const activeSpent = $derived(
		activeCategory ? getSkillPointsSpentForCategory(build.sheetData, build.theme, activeCategory.id) : 0
	);
	const activePool = $derived(
		activeCategory ? getSkillPoolForCategory(build.sheetData, build.theme, activeCategory.id) : 0
	);

	const customForActive = $derived(
		(build.sheetData.znz?.customSkills ?? []).filter((c) => c.attribute === activeCategoryId)
	);

	function cloneSheet(data: CharacterData): CharacterData {
		return cloneSheetData(data);
	}

	function applyCategoryChange(categoryId: string, next: CharacterData): boolean {
		const spent = getSkillPointsSpentForCategory(next, build.theme, categoryId);
		const pool = getSkillPoolForCategory(next, build.theme, categoryId);
		if (spent > pool) return false;
		setBuildSheetData(build, next);
		return true;
	}

	function bumpSkill(catId: string, skillId: string, delta: number) {
		const current = build.sheetData.skills[catId]?.[skillId] ?? 0;
		const nextRank = Math.max(0, Math.min(SKILL_RANK_CAP, current + delta));
		if (nextRank === current) return;

		const next = cloneSheet(build.sheetData);
		if (!next.skills[catId]) next.skills[catId] = {};
		next.skills[catId][skillId] = nextRank;
		applyCategoryChange(catId, next);
	}

	function bumpKnowledge(lineId: string, delta: number) {
		const lines = build.sheetData.znz?.knowledgeLines ?? [];
		const idx = lines.findIndex((l) => l.id === lineId);
		if (idx < 0) return;
		const current = lines[idx].rank;
		const nextRank = Math.max(0, Math.min(SKILL_RANK_CAP, current + delta));
		if (nextRank === current) return;

		const next = cloneSheet(build.sheetData);
		next.znz!.knowledgeLines![idx] = { ...next.znz!.knowledgeLines![idx], rank: nextRank };
		applyCategoryChange('mind', next);
	}

	function bumpCustom(id: string, delta: number) {
		const skills = build.sheetData.znz?.customSkills ?? [];
		const idx = skills.findIndex((c) => c.id === id);
		if (idx < 0) return;
		const attr = skills[idx].attribute;
		const current = skills[idx].rank;
		const nextRank = Math.max(0, Math.min(SKILL_RANK_CAP, current + delta));
		if (nextRank === current) return;

		const next = cloneSheet(build.sheetData);
		next.znz!.customSkills![idx] = { ...next.znz!.customSkills![idx], rank: nextRank };
		applyCategoryChange(attr, next);
	}

	function addKnowledgeLine() {
		const line: KnowledgeLine = {
			id: newLineId('know'),
			presetId: KNOWLEDGE_PRESETS[0]?.id ?? 'biology',
			detail: '',
			rank: 0
		};
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				knowledgeLines: [...(build.sheetData.znz?.knowledgeLines ?? []), line]
			}
		});
	}

	function updateKnowledgeLine(id: string, patch: Partial<Pick<KnowledgeLine, 'presetId' | 'detail'>>) {
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				knowledgeLines: (build.sheetData.znz?.knowledgeLines ?? []).map((l) =>
					l.id === id ? { ...l, ...patch } : l
				)
			}
		});
	}

	function removeKnowledgeLine(id: string) {
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				knowledgeLines: (build.sheetData.znz?.knowledgeLines ?? []).filter((l) => l.id !== id)
			}
		});
	}

	function addCustomSkill() {
		const row: CustomSkillLine = {
			id: newLineId('custom'),
			label: '',
			description: '',
			attribute: activeCategoryId,
			rank: 0
		};
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				customSkills: [...(build.sheetData.znz?.customSkills ?? []), row]
			}
		});
	}

	function updateCustomSkill(id: string, patch: Partial<Pick<CustomSkillLine, 'label' | 'description'>>) {
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				customSkills: (build.sheetData.znz?.customSkills ?? []).map((c) =>
					c.id === id ? { ...c, ...patch } : c
				)
			}
		});
	}

	function removeCustomSkill(id: string) {
		setBuildSheetData(build, {
			...build.sheetData,
			znz: {
				...build.sheetData.znz,
				customSkills: (build.sheetData.znz?.customSkills ?? []).filter((c) => c.id !== id)
			}
		});
	}

	function raiseCost(current: number): number {
		return getCostToRaiseSkill(current);
	}

	function raiseCostLabel(current: number): string {
		return `Next rank cost: ${raiseCost(current)}`;
	}

	async function goBack() {
		await saveBuild(build);
		if (previousCategoryId) {
			goto(`/characters/${build.characterId}/build/skills?category=${previousCategoryId}`);
			return;
		}
		goto(`/characters/${build.characterId}/build/attributes`);
	}

	async function continueNext() {
		await saveBuild(build);
		if (nextCategoryId) {
			goto(`/characters/${build.characterId}/build/skills?category=${nextCategoryId}`);
			return;
		}
		goto(`/characters/${build.characterId}/build/abilities`);
	}

	const backLabel = $derived(
		previousCategoryId ? `Back to Skills: ${previousCategoryLabel}` : 'Back to Attributes'
	);

	const continueLabel = $derived(
		nextCategoryLabel ? `Continue to Skills: ${nextCategoryLabel}` : 'Continue to Abilities'
	);
</script>

<BuildShell currentStep="skills">
	<div class="step-page">
		<div class="step-header">
			<div>
				<h1 class="step-title">{build.characterName || 'Create New Character'}</h1>
				<h2 class="step-subtitle">Choose your skills for {activeCategory?.label ?? activeCategoryId}</h2>
				<p class="step-desc">
					Spend skill points on {activeCategory?.label ?? 'this'} skills. Each rank costs more to raise (1, then 2, then 3…).
				</p>
			</div>
		</div>

		{#if activeCategory}
			<div
				class="category-intro"
				style="--tab-accent: {activeStyle.accent}; --tab-bg: {activeStyle.bg}; --tab-border: {activeStyle.border}"
			>
				<span class="category-intro-icon">
					<AttributeCategoryIcon categoryId={activeCategoryId} class="category-intro-icon-glyph" />
				</span>
				<div class="category-intro-body">
					<h3 class="category-intro-title">{activeAttr?.label ?? activeCategory.label}</h3>
					<p class="category-intro-desc">{categoryIntros[activeCategoryId]}</p>
					<p class="category-intro-meta">{activeAttr?.description}</p>
				</div>
			</div>
		{/if}

		<div class="skills-layout">
			<div class="skills-main">
				{#if activeCategory}
					<ul class="skill-list">
						{#each activeCategory.skills as skill}
							{#if skill.kind !== 'knowledge'}
								{@const rank = build.sheetData.skills[activeCategory.id]?.[skill.id] ?? 0}
								<li class="skill-row" class:skill-row-active={rank > 0}>
									<span class="skill-icon-wrap" style="--skill-accent: {(tabStyles[activeCategory.id] ?? tabStyles.body).accent}">
										<i class={skillIconClass(skill.id)} aria-hidden="true"></i>
									</span>
									<div class="skill-text">
										<p class="skill-name">{skill.label}</p>
										{#if skill.description}
											<p class="skill-desc">{skill.description}</p>
										{/if}
									</div>
									<div class="skill-controls">
										<div class="skill-stepper">
											<button
												type="button"
												class="skill-btn"
												disabled={rank <= 0}
												onclick={() => bumpSkill(activeCategory.id, skill.id, -1)}
												aria-label="Decrease {skill.label}"
											>−</button>
											<span class="skill-value">{rank}</span>
											<button
												type="button"
												class="skill-btn"
												disabled={rank >= SKILL_RANK_CAP || getCostToRaiseSkill(rank) > getRemainingSkillPoints(build.sheetData, build.theme, activeCategory.id)}
												onclick={() => bumpSkill(activeCategory.id, skill.id, 1)}
												aria-label="Increase {skill.label}"
											>+</button>
										</div>
										<p class="skill-cost" class:skill-cost-empty={rank >= SKILL_RANK_CAP}>
											{raiseCostLabel(rank)}
										</p>
									</div>
								</li>
							{/if}
						{/each}

						{#if activeCategoryId === 'mind'}
							<li class="skill-row knowledge-header">
								<span class="skill-icon-wrap" style="--skill-accent: {tabStyles.mind.accent}">
									<i class={skillIconClass('knowledge')} aria-hidden="true"></i>
								</span>
								<div class="skill-text">
									<p class="skill-name">Knowledge</p>
									<p class="skill-desc">Add specializations and raise each field separately.</p>
								</div>
								<button type="button" class="btn-add-line" onclick={addKnowledgeLine}>
									+ Add specialization
								</button>
							</li>
							{#each build.sheetData.znz?.knowledgeLines ?? [] as line (line.id)}
								{@const rank = line.rank}
								<li
									class="knowledge-subitem"
									class:knowledge-subitem-active={rank > 0}
								>
									<div class="knowledge-subitem-body">
										<div class="skill-text knowledge-fields">
											<select
												class="knowledge-select"
												value={line.presetId}
												onchange={(e) => updateKnowledgeLine(line.id, { presetId: e.currentTarget.value })}
											>
												{#each KNOWLEDGE_PRESETS as preset}
													<option value={preset.id}>{preset.label}</option>
												{/each}
											</select>
											<input
												type="text"
												class="knowledge-detail"
												placeholder="Optional detail"
												value={line.detail}
												oninput={(e) => updateKnowledgeLine(line.id, { detail: e.currentTarget.value })}
											/>
											<p class="skill-desc">{knowledgeLabel(line.presetId, line.detail)}</p>
										</div>
										<div class="skill-controls">
											<div class="skill-stepper">
												<button
													type="button"
													class="skill-btn"
													disabled={rank <= 0}
													onclick={() => bumpKnowledge(line.id, -1)}
												>−</button>
												<span class="skill-value">{rank}</span>
												<button
													type="button"
													class="skill-btn"
													disabled={rank >= SKILL_RANK_CAP || getCostToRaiseSkill(rank) > getRemainingSkillPoints(build.sheetData, build.theme, 'mind')}
													onclick={() => bumpKnowledge(line.id, 1)}
												>+</button>
											</div>
											<p class="skill-cost" class:skill-cost-empty={rank >= SKILL_RANK_CAP}>
												{raiseCostLabel(rank)}
											</p>
											<button type="button" class="btn-remove" onclick={() => removeKnowledgeLine(line.id)}>Remove</button>
										</div>
									</div>
								</li>
							{/each}
						{/if}

						{#each customForActive as custom (custom.id)}
							{@const rank = custom.rank}
							<li class="skill-row custom-row" class:skill-row-active={rank > 0}>
								<span class="skill-icon-wrap" style="--skill-accent: {(tabStyles[activeCategory.id] ?? tabStyles.body).accent}">
									<i class={skillIconClass('custom')} aria-hidden="true"></i>
								</span>
								<div class="skill-text knowledge-fields">
									<input
										type="text"
										class="custom-name"
										placeholder="Custom skill name"
										value={custom.label}
										oninput={(e) => updateCustomSkill(custom.id, { label: e.currentTarget.value })}
									/>
									<input
										type="text"
										class="custom-desc-input"
										placeholder="Description (optional)"
										value={custom.description}
										oninput={(e) => updateCustomSkill(custom.id, { description: e.currentTarget.value })}
									/>
								</div>
								<div class="skill-controls">
									<div class="skill-stepper">
										<button type="button" class="skill-btn" disabled={rank <= 0} onclick={() => bumpCustom(custom.id, -1)}>−</button>
										<span class="skill-value">{rank}</span>
										<button
											type="button"
											class="skill-btn"
											disabled={rank >= SKILL_RANK_CAP || getCostToRaiseSkill(rank) > getRemainingSkillPoints(build.sheetData, build.theme, activeCategory.id)}
											onclick={() => bumpCustom(custom.id, 1)}
										>+</button>
									</div>
									<p class="skill-cost" class:skill-cost-empty={rank >= SKILL_RANK_CAP}>
										{raiseCostLabel(rank)}
									</p>
									<button type="button" class="btn-remove" onclick={() => removeCustomSkill(custom.id)}>Remove</button>
								</div>
							</li>
						{/each}
					</ul>

					<button type="button" class="btn-add-custom" onclick={addCustomSkill}>
						+ Add Custom {activeCategory.label} Skill
					</button>
				{/if}
			</div>

			<aside class="skills-sidebar">
				{#if activeCategory}
					{@const pct = activePool > 0 ? Math.min(100, (activeSpent / activePool) * 100) : 0}
					<div class="sidebar-card">
						<p class="sidebar-label">{activeCategory.label} points</p>
						<div class="progress-ring" style="--pct: {pct}; --ring-color: {(tabStyles[activeCategory.id] ?? tabStyles.body).accent}">
							<div class="progress-ring-inner">
								<span class="progress-ring-value">{activeSpent} / {activePool}</span>
							</div>
						</div>
						<ul class="sidebar-notes">
							<li>Spend up to {activePool} points on {activeCategory.label} skills</li>
							<li>Costs escalate the higher the rank of skill</li>
						</ul>
					</div>
				{/if}
			</aside>
		</div>
	</div>

	{#snippet footer()}
		<button type="button" class="btn-back" onclick={goBack}>
			<span aria-hidden="true">←</span> {backLabel}
		</button>
		<button type="button" class="btn-continue" onclick={continueNext}>
			{continueLabel} <span aria-hidden="true">→</span>
		</button>
	{/snippet}
</BuildShell>

<style>
	.step-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
		max-width: 36rem;
		font-size: 0.9rem;
		color: #8899aa;
		line-height: 1.5;
	}

	.category-intro {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--tab-border);
		border-left: 4px solid var(--tab-border);
		border-radius: 0.5rem;
		background: var(--tab-bg);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.category-intro-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.375rem;
		background: rgba(255, 255, 255, 0.06);
		color: var(--tab-accent);
		flex-shrink: 0;
	}

	:global(.category-intro-icon-glyph) {
		font-size: 1.15rem;
	}

	.category-intro-body {
		min-width: 0;
	}

	.category-intro-title {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--tab-accent);
	}

	.category-intro-desc {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: #c5d0dc;
		line-height: 1.5;
	}

	.category-intro-meta {
		margin: 0;
		font-size: 0.82rem;
		color: #8899aa;
		line-height: 1.45;
	}

	.skills-layout {
		display: grid;
		grid-template-columns: 1fr 16rem;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 960px) {
		.skills-layout {
			grid-template-columns: 1fr;
		}
	}

	.skill-list {
		background: #1a2332;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.skill-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid #243044;
	}

	.skill-row-active {
		background: rgba(93, 173, 226, 0.1);
		border-bottom-color: rgba(93, 173, 226, 0.25);
	}

	.skill-icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--skill-accent) 18%, #141b26);
		color: var(--skill-accent);
		font-size: 0.8rem;
		flex-shrink: 0;
	}

	.skill-text {
		min-width: 0;
	}

	.skill-name {
		font-weight: 600;
		font-size: 0.875rem;
		color: #e8ecf1;
		line-height: 1.2;
	}

	.skill-desc {
		margin-top: 0.1rem;
		font-size: 0.72rem;
		color: #8899aa;
		line-height: 1.25;
	}

	.skill-controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		min-width: 6.75rem;
		flex-shrink: 0;
	}

	.skill-stepper {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.skill-btn {
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 0.3rem;
		border: 1px solid #3a4d66;
		background: #141b26;
		color: #e8ecf1;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.skill-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.skill-value {
		min-width: 1rem;
		text-align: center;
		font-size: 0.95rem;
		font-weight: 700;
		color: #e8ecf1;
	}

	.skill-cost {
		width: 100%;
		min-height: 0.95rem;
		font-size: 0.65rem;
		color: #8899aa;
		text-align: center;
		white-space: nowrap;
		line-height: 0.95rem;
	}

	.skill-cost-empty {
		visibility: hidden;
	}

	.knowledge-header .btn-add-line {
		justify-self: end;
	}

	.knowledge-subitem {
		list-style: none;
		margin: 0;
		padding: 0.35rem 0.75rem 0.35rem 0;
		border-bottom: 1px solid #243044;
		background: #141b26;
	}

	.knowledge-subitem-active {
		background: rgba(93, 173, 226, 0.06);
	}

	.knowledge-subitem-body {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
		align-items: center;
		margin-left: 2.25rem;
		padding: 0.45rem 0.65rem 0.45rem 0.85rem;
		border-left: 3px solid #3498db;
		border-radius: 0 0.35rem 0.35rem 0;
		background: #1a2332;
		box-shadow: inset 0 0 0 1px #2d3a4d;
	}

	.knowledge-subitem-active .knowledge-subitem-body {
		background: rgba(93, 173, 226, 0.1);
		border-left-color: #5dade2;
		box-shadow: inset 0 0 0 1px rgba(93, 173, 226, 0.25);
	}

	.knowledge-fields {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.knowledge-select,
	.knowledge-detail,
	.custom-name,
	.custom-desc-input {
		width: 100%;
		max-width: 18rem;
		border: 1px solid #3a4d66;
		border-radius: 0.3rem;
		padding: 0.2rem 0.4rem;
		font-size: 0.78rem;
		background: #0f141c;
		color: #e8ecf1;
	}

	.btn-add-line,
	.btn-remove {
		border: none;
		background: transparent;
		font-size: 0.75rem;
		color: #8899aa;
		cursor: pointer;
		text-decoration: underline;
	}

	.btn-add-custom {
		margin-top: 0.75rem;
		width: 100%;
		padding: 0.55rem 0.75rem;
		border: 2px dashed #3a4d66;
		border-radius: 0.5rem;
		background: transparent;
		color: #8899aa;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.btn-add-custom:hover {
		border-color: #5dade2;
		background: rgba(93, 173, 226, 0.06);
		color: #c5d0dc;
	}

	.skills-sidebar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sidebar-card {
		background: #1a2332;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		padding: 1.25rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
	}

	.sidebar-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #8899aa;
		margin-bottom: 0.5rem;
	}

	.progress-ring {
		--size: 7rem;
		width: var(--size);
		height: var(--size);
		margin: 0.75rem auto 1rem;
		border-radius: 9999px;
		background: conic-gradient(var(--ring-color) calc(var(--pct) * 1%), #243044 0);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.progress-ring-inner {
		width: calc(var(--size) - 1rem);
		height: calc(var(--size) - 1rem);
		border-radius: 9999px;
		background: #1a2332;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.progress-ring-value {
		font-size: 1rem;
		font-weight: 700;
		color: #e8ecf1;
	}

	.sidebar-notes {
		font-size: 0.78rem;
		color: #8899aa;
		line-height: 1.5;
		padding-left: 1.1rem;
	}

	.sidebar-notes li + li {
		margin-top: 0.35rem;
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

	.btn-continue:hover {
		background: #7ec0ea;
	}
</style>
