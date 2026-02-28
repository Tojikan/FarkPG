<script lang="ts">
	import { onMount } from 'svelte';
	import { neonCityTheme } from '$lib/data/cyberpunkTheme';
	import {
		createEmptyCharacter,
		loadCharacter,
		saveCharacter,
		STORAGE_KEY_NEON,
		getRemainingAttributePoints,
		getRemainingSkillPoints,
		getRemainingAbilityPoints,
		getHealthMax,
		syncHealthMaxToCharacter
	} from '$lib/data/character';
	import type { Character, Theme } from '$lib/data/types';

	const theme: Theme = neonCityTheme;
	let character = $state<Character>(createEmptyCharacter(theme));
	let buildModalOpen = $state(false);

	const fateLabel = $derived((theme as { luckMax?: number }).luckMax != null ? 'Luck' : 'Fate');

	function load() {
		const loaded = loadCharacter(STORAGE_KEY_NEON, theme);
		if (loaded) character = syncHealthMaxToCharacter(loaded, theme);
	}

	function persist() {
		saveCharacter(character, STORAGE_KEY_NEON, theme);
	}

	$effect(() => {
		persist();
	});

	onMount(load);

	function setAttribute(id: string, v: number) {
		const attr = theme.attributes.find((a) => a.id === id);
		if (!attr) return;
		const n = Math.max(attr.min, Math.min(attr.max, v));
		let next = { ...character, attributes: { ...character.attributes, [id]: n } };
		// When endurance (or health-driving attribute) changes, update health max and clamp current
		const healthRule = theme.healthFromAttribute;
		if (healthRule && healthRule.attributeId === id) {
			const newMax = getHealthMax(next, theme);
			const h = next.health ?? { current: 0, max: 0 };
			next = { ...next, health: { current: Math.min(h.current, newMax), max: newMax } };
		}
		character = next;
	}

	function setSkill(catId: string, skillId: string, v: number) {
		const n = Math.max(0, v);
		character = {
			...character,
			skills: {
				...character.skills,
				[catId]: { ...(character.skills[catId] ?? {}), [skillId]: n }
			}
		};
	}

	function getAbilityCost(abilityId: string): number {
		const ab = theme.abilities.find((a) => a.id === abilityId);
		if (ab) return ab.cost;
		const custom = character.custom?.abilities ?? [];
		const c = custom.find((a) => a.id === abilityId);
		return c?.cost ?? 1;
	}

	function toggleAbility(abilityId: string) {
		const cost = getAbilityCost(abilityId);
		const cur = character.abilities[abilityId] ?? 0;
		const rem = getRemainingAbilityPoints(character, theme);
		if (cur === 0 && rem < cost) return;
		character = {
			...character,
			abilities: { ...character.abilities, [abilityId]: cur === 0 ? 1 : 0 }
		};
	}

	const themeEnhancements = $derived(theme.enhancements ?? []);
	const customEnhancements = $derived(character.custom?.enhancements ?? []);

	function getEnhancementCost(enhancementId: string): number {
		const e = themeEnhancements.find((x) => x.id === enhancementId);
		if (e) return e.cost;
		const c = customEnhancements.find((x) => x.id === enhancementId);
		return c?.cost ?? 1;
	}

	function toggleEnhancement(enhancementId: string) {
		const cost = getEnhancementCost(enhancementId);
		const cur = (character.enhancements ?? {})[enhancementId] ?? 0;
		const rem = getRemainingAbilityPoints(character, theme);
		if (cur === 0 && rem < cost) return;
		character = {
			...character,
			enhancements: { ...(character.enhancements ?? {}), [enhancementId]: cur === 0 ? 1 : 0 }
		};
	}

	function nextEnhId(): string {
		const used = customEnhancements.map((c) => {
			const m = c.id.match(/^enh(\d+)$/);
			return m ? parseInt(m[1], 10) : 0;
		});
		const n = used.length === 0 ? 1 : Math.max(...used) + 1;
		return `enh${n}`;
	}

	function addCustomEnhancement() {
		const id = nextEnhId();
		const list = [...(character.custom?.enhancements ?? []), { id, label: '', text: '', description: '', cost: 1 }];
		character = {
			...character,
			custom: { ...character.custom, enhancements: list },
			enhancements: { ...(character.enhancements ?? {}), [id]: 0 }
		};
	}

	function updateCustomEnhancement(index: number, patch: { label?: string; text?: string; description?: string; cost?: number }) {
		const list = [...(character.custom?.enhancements ?? [])];
		if (index < 0 || index >= list.length) return;
		list[index] = { ...list[index], ...patch };
		character = { ...character, custom: { ...character.custom, enhancements: list } };
	}

	function removeCustomEnhancement(index: number) {
		const list = character.custom?.enhancements ?? [];
		if (index < 0 || index >= list.length) return;
		const id = list[index].id;
		const nextList = list.filter((_, i) => i !== index);
		const nextEnh = { ...(character.enhancements ?? {}) };
		delete nextEnh[id];
		character = {
			...character,
			custom: { ...character.custom, enhancements: nextList },
			enhancements: nextEnh
		};
	}

	const customAbilities = $derived(character.custom?.abilities ?? []);

	function nextCustomId(): string {
		const used = customAbilities.map((c) => {
			const m = c.id.match(/^custom(\d+)$/);
			return m ? parseInt(m[1], 10) : 0;
		});
		const n = used.length === 0 ? 1 : Math.max(...used) + 1;
		return `custom${n}`;
	}

	function addCustomAbility() {
		const id = nextCustomId();
		const list = [...(character.custom?.abilities ?? []), { id, label: '', text: '', description: '', cost: 1 }];
		character = {
			...character,
			custom: { ...character.custom, abilities: list },
			abilities: { ...character.abilities, [id]: 0 }
		};
	}

	function updateCustomAbility(index: number, patch: { label?: string; text?: string; description?: string; cost?: number }) {
		const list = [...(character.custom?.abilities ?? [])];
		if (index < 0 || index >= list.length) return;
		list[index] = { ...list[index], ...patch };
		character = { ...character, custom: { ...character.custom, abilities: list } };
	}

	function removeCustomAbility(index: number) {
		const list = character.custom?.abilities ?? [];
		if (index < 0 || index >= list.length) return;
		const id = list[index].id;
		const nextList = list.filter((_, i) => i !== index);
		const nextAb = { ...character.abilities };
		delete nextAb[id];
		character = {
			...character,
			custom: { ...character.custom, abilities: nextList },
			abilities: nextAb
		};
	}

	function setHealthCurrent(delta: number) {
		const h = character.health ?? { current: 0, max: 10 };
		const next = Math.max(0, Math.min(h.max, h.current + delta));
		character = { ...character, health: { ...h, current: next } };
	}

	function setHealthCurrentVal(v: number) {
		const h = character.health ?? { current: 0, max: 10 };
		const max = h.max;
		character = { ...character, health: { ...h, current: Math.max(0, Math.min(max, v)), max } };
	}

	function setHealthMaxVal(v: number) {
		const h = character.health ?? { current: 0, max: 10 };
		const max = Math.max(1, v);
		character = { ...character, health: { current: Math.min(h.current, max), max } };
	}

	function setXp(delta: number) {
		const cur = character.xp ?? 0;
		character = { ...character, xp: Math.max(0, cur + delta) };
	}

	function setFate(delta: number) {
		const f = character.fate;
		const next = Math.max(0, Math.min(f.max, f.current + delta));
		character = { ...character, fate: { ...f, current: next } };
	}

	function setFateVal(v: number) {
		const max = character.fate.max;
		character = { ...character, fate: { current: Math.max(0, Math.min(max, v)), max } };
	}

	function setFateMaxVal(v: number) {
		const max = Math.max(0, v);
		character = { ...character, fate: { current: Math.min(character.fate.current, max), max } };
	}

	function deleteSavedData() {
		if (typeof window === 'undefined') return;
		if (!window.confirm('Delete all saved character data for this builder? This cannot be undone.')) return;
		try {
			localStorage.removeItem(STORAGE_KEY_NEON);
			character = createEmptyCharacter(theme);
			buildModalOpen = false;
		} catch (_) {}
	}

	/** Should this skill category be shown? (alwaysDisplay true => show all; false => show only if any skill > 0) */
	function showSkillCategory(cat: { alwaysDisplay?: boolean }, catId: string): boolean {
		if (cat.alwaysDisplay) return true;
		const skills = character.skills[catId];
		if (!skills) return false;
		return Object.values(skills).some((v) => v > 0);
	}

	/** Should this skill row be shown? (alwaysDisplay => yes; else only if value > 0) */
	function showSkill(cat: { alwaysDisplay?: boolean }, catId: string, skillId: string): boolean {
		if (cat.alwaysDisplay) return true;
		return (character.skills[catId]?.[skillId] ?? 0) > 0;
	}
</script>

<svelte:head>
	<title>Neon City (cyberpunk) character builder – FarkPG</title>
</svelte:head>

<div class="builder">
	<div class="builder-toolbar">
		<a href="/builders" class="back-link">← Builders</a>
		<div class="toolbar-actions">
			<button type="button" class="btn-build" onclick={() => (buildModalOpen = true)}>Build Character</button>
			<button type="button" class="btn-delete" onclick={deleteSavedData}>Delete saved data</button>
		</div>
	</div>

	<!-- Wireframe: top = name+notes | HP, XP, Fate -->
	<div class="sheet wireframe">
		<div class="top-row">
			<div class="block name-notes">
				<label class="block-label">Name</label>
				<input type="text" class="field-input name-input" value={character.name ?? ''} placeholder="Character name" oninput={(e) => (character = { ...character, name: (e.target as HTMLInputElement).value })} />
				<label class="block-label notes-label">Notes</label>
				<textarea class="field-textarea" placeholder="Notes…" value={character.notes ?? ''} oninput={(e) => (character = { ...character, notes: (e.target as HTMLTextAreaElement).value })}></textarea>
			</div>
			<div class="block stats-col">
				<div class="stat-row stat-row-hp">
					<label class="block-label">HP</label>
					<div class="stat-display stat-display-hp">
						<input type="number" min="0" max={character.health?.max ?? 10} class="stat-big stat-big-hp" value={character.health?.current ?? 0} oninput={(e) => setHealthCurrentVal(Number((e.target as HTMLInputElement).value))} />
						<span class="stat-small">/ </span>
						<input type="number" min="1" class="stat-max-inline" value={character.health?.max ?? 10} oninput={(e) => setHealthMaxVal(Number((e.target as HTMLInputElement).value) || 1)} />
					</div>
				</div>
				<div class="stat-row">
					<label class="block-label">XP</label>
					<div class="stat-display">
						<input type="number" min="0" class="stat-big" value={character.xp ?? 0} oninput={(e) => (character = { ...character, xp: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
					</div>
				</div>
				<div class="stat-row stat-row-fate">
					<label class="block-label">{fateLabel}</label>
					<div class="stat-display">
						<input type="number" min="0" max={character.fate.max} class="stat-big stat-big-fate" value={character.fate.current} oninput={(e) => setFateVal(Number((e.target as HTMLInputElement).value))} />
						<span class="stat-small">/ </span>
						<input type="number" min="0" class="stat-max-inline" value={character.fate.max} oninput={(e) => setFateMaxVal(Number((e.target as HTMLInputElement).value) || 0)} />
					</div>
				</div>
			</div>
		</div>

		<!-- Middle: Attributes (left) | Skills (right, 2x2) -->
		<div class="middle-row">
			<div class="block attributes-block attributes-separator">
				<h2 class="block-title">Attributes</h2>
				<div class="attr-list">
					{#each theme.attributes as attr}
						{@const val = character.attributes[attr.id] ?? attr.default}
						<div class="attr-row">
							<label class="attr-label">{attr.label}</label>
							<input type="number" min={attr.min} max={attr.max} class="attr-input" value={val} oninput={(e) => setAttribute(attr.id, Number((e.target as HTMLInputElement).value) || attr.min)} />
						</div>
					{/each}
				</div>
			</div>
			<div class="skills-grid">
				{#each Object.entries(theme.skills) as [catId, cat]}
					{#if showSkillCategory(cat, catId)}
						<div class="block skill-block">
							<h3 class="block-title">{cat.label}</h3>
							<ul class="skill-list">
								{#each cat.skills as skill}
									{#if showSkill(cat, catId, skill.id)}
										{@const val = character.skills[catId]?.[skill.id] ?? 0}
										<li class="skill-row">
											<label class="skill-label">{skill.label}</label>
											<input type="number" min="0" class="skill-input" value={val} oninput={(e) => setSkill(catId, skill.id, Number((e.target as HTMLInputElement).value) || 0)} />
										</li>
									{/if}
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Bottom: Abilities (only show abilities the character has) -->
		<div class="bottom-row">
			<div class="block abilities-block">
				<h2 class="block-title">Abilities</h2>
				<ul class="ability-list">
					{#each theme.abilities.filter((ab) => (character.abilities[ab.id] ?? 0) > 0) as ab}
						<li class="ability-row">
							<span class="ability-name">{ab.label}</span>
							<p class="ability-desc">{ab.description}</p>
						</li>
					{/each}
					{#each customAbilities.filter((c) => (character.abilities[c.id] ?? 0) > 0) as c}
						<li class="ability-row">
							<span class="ability-name">{c.label || c.id}</span>
							{#if c.text}<p class="ability-text">{c.text}</p>{/if}
							<p class="ability-desc">{c.description}</p>
						</li>
					{/each}
				</ul>
				{#if theme.abilities.filter((ab) => (character.abilities[ab.id] ?? 0) > 0).length === 0 && customAbilities.filter((c) => (character.abilities[c.id] ?? 0) > 0).length === 0}
					<p class="ability-empty">No abilities yet. Use Build Character to add some.</p>
				{/if}
			</div>
			<div class="block abilities-block enhancements-block">
				<h2 class="block-title">Enhancements</h2>
				<ul class="ability-list">
					{#each themeEnhancements.filter((e) => (character.enhancements ?? {})[e.id] > 0) as e}
						<li class="ability-row">
							<span class="ability-name">{e.label}</span>
							<p class="ability-desc">{e.description}</p>
						</li>
					{/each}
					{#each customEnhancements.filter((c) => (character.enhancements ?? {})[c.id] > 0) as c}
						<li class="ability-row">
							<span class="ability-name">{c.label || c.id}</span>
							{#if c.text}<p class="ability-text">{c.text}</p>{/if}
							<p class="ability-desc">{c.description}</p>
						</li>
					{/each}
				</ul>
				{#if themeEnhancements.filter((e) => (character.enhancements ?? {})[e.id] > 0).length === 0 && customEnhancements.filter((c) => (character.enhancements ?? {})[c.id] > 0).length === 0}
					<p class="ability-empty">No enhancements yet. Use Build Character to add some.</p>
				{/if}
			</div>
		</div>
	</div>

	<p class="autosave-note">Character data is saved automatically to this device.</p>
</div>

<!-- Build Character modal -->
{#if buildModalOpen}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Build character" onclick={(e) => e.target === e.currentTarget && (buildModalOpen = false)}>
		<div class="modal-content">
			<div class="modal-header">
				<h2>Build Character</h2>
				<button type="button" class="modal-close" aria-label="Close" onclick={() => (buildModalOpen = false)}>×</button>
			</div>
			<div class="modal-body">
				<section class="modal-section">
					<label class="block-label">Name</label>
					<input type="text" class="field-input name-input full" value={character.name ?? ''} oninput={(e) => (character = { ...character, name: (e.target as HTMLInputElement).value })} />
				</section>
				<section class="modal-section">
					<label class="block-label">Notes</label>
					<textarea class="field-textarea full" value={character.notes ?? ''} oninput={(e) => (character = { ...character, notes: (e.target as HTMLTextAreaElement).value })}></textarea>
				</section>
				<section class="modal-section modal-stat-row">
					<label class="block-label">HP</label>
					<div class="stat-display stat-display-hp">
						<input type="number" min="0" max={character.health?.max ?? 10} class="stat-big stat-big-hp" value={character.health?.current ?? 0} oninput={(e) => setHealthCurrentVal(Number((e.target as HTMLInputElement).value))} />
						<span class="stat-small">/ </span>
						<input type="number" min="1" class="stat-max-inline" value={character.health?.max ?? 10} oninput={(e) => setHealthMaxVal(Number((e.target as HTMLInputElement).value) || 1)} />
					</div>
				</section>
				<section class="modal-section modal-stat-row">
					<label class="block-label">XP</label>
					<div class="stat-display">
						<input type="number" min="0" class="stat-big" value={character.xp ?? 0} oninput={(e) => (character = { ...character, xp: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
					</div>
				</section>
				<section class="modal-section modal-stat-row modal-stat-row-fate">
					<label class="block-label">{fateLabel}</label>
					<div class="stat-display">
						<input type="number" min="0" max={character.fate.max} class="stat-big stat-big-fate" value={character.fate.current} oninput={(e) => setFateVal(Number((e.target as HTMLInputElement).value))} />
						<span class="stat-small">/ </span>
						<input type="number" min="0" class="stat-max-inline" value={character.fate.max} oninput={(e) => setFateMaxVal(Number((e.target as HTMLInputElement).value) || 0)} />
					</div>
				</section>
				<section class="modal-section attributes-separator">
					<h3 class="block-title">Attributes</h3>
					<p class="points-hint">Available points: {getRemainingAttributePoints(character, theme)} / {character.points.attributes}</p>
					<div class="attr-list">
						{#each theme.attributes as attr}
							{@const val = character.attributes[attr.id] ?? attr.default}
							<div class="attr-row">
								<label class="attr-label">{attr.label}</label>
								<input type="number" min={attr.min} max={attr.max} class="attr-input" value={val} oninput={(e) => setAttribute(attr.id, Number((e.target as HTMLInputElement).value) || attr.min)} />
							</div>
						{/each}
					</div>
				</section>
				{#each Object.entries(theme.skills) as [catId, cat]}
					{@const rem = getRemainingSkillPoints(character, theme, catId)}
					{@const max = character.points.skills?.[catId] ?? theme.points.skills[catId]}
					<section class="modal-section">
						<h3 class="block-title">{cat.label}</h3>
						<p class="points-hint">Available points: {rem} / {max}</p>
						<ul class="skill-list">
							{#each cat.skills as skill}
								{@const val = character.skills[catId]?.[skill.id] ?? 0}
								<li class="skill-row">
									<label class="skill-label">{skill.label}</label>
									<input type="number" min="0" class="skill-input" value={val} oninput={(e) => setSkill(catId, skill.id, Number((e.target as HTMLInputElement).value) || 0)} />
								</li>
							{/each}
						</ul>
					</section>
				{/each}
				<section class="modal-section">
					<h3 class="block-title">Abilities</h3>
					<p class="points-hint">Available points: {getRemainingAbilityPoints(character, theme)} / {character.points.abilities}</p>
					<ul class="ability-list ability-list-builder">
						{#each theme.abilities as ab}
							{@const taken = (character.abilities[ab.id] ?? 0) > 0}
							<li class="ability-row">
								<button type="button" class="ability-btn" class:ability-taken={taken} disabled={!taken && getRemainingAbilityPoints(character, theme) < ab.cost} onclick={() => toggleAbility(ab.id)}>
									{taken ? '✓' : '○'} {ab.label} (cost {ab.cost})
								</button>
								<p class="ability-desc">{ab.description}</p>
							</li>
						{/each}
						{#each customAbilities as c}
							{@const taken = (character.abilities[c.id] ?? 0) > 0}
							<li class="ability-row">
								<button type="button" class="ability-btn" class:ability-taken={taken} disabled={!taken && getRemainingAbilityPoints(character, theme) < (c.cost ?? 1)} onclick={() => toggleAbility(c.id)}>
									{taken ? '✓' : '○'} {c.label || c.id} (cost {c.cost})
								</button>
								{#if c.text}<p class="ability-text">{c.text}</p>{/if}
								<p class="ability-desc">{c.description}</p>
							</li>
						{/each}
					</ul>
				</section>
				<section class="modal-section">
					<h3 class="block-title">Enhancements</h3>
					<p class="points-hint">Available points: {getRemainingAbilityPoints(character, theme)} / {character.points.abilities}</p>
					<ul class="ability-list ability-list-builder">
						{#each themeEnhancements as e}
							{@const taken = (character.enhancements ?? {})[e.id] > 0}
							<li class="ability-row">
								<button type="button" class="ability-btn" class:ability-taken={taken} disabled={!taken && getRemainingAbilityPoints(character, theme) < e.cost} onclick={() => toggleEnhancement(e.id)}>
									{taken ? '✓' : '○'} {e.label} (cost {e.cost})
								</button>
								<p class="ability-desc">{e.description}</p>
							</li>
						{/each}
						{#each customEnhancements as c}
							{@const taken = (character.enhancements ?? {})[c.id] > 0}
							<li class="ability-row">
								<button type="button" class="ability-btn" class:ability-taken={taken} disabled={!taken && getRemainingAbilityPoints(character, theme) < (c.cost ?? 1)} onclick={() => toggleEnhancement(c.id)}>
									{taken ? '✓' : '○'} {c.label || c.id} (cost {c.cost})
								</button>
								{#if c.text}<p class="ability-text">{c.text}</p>{/if}
								<p class="ability-desc">{c.description}</p>
							</li>
						{/each}
					</ul>
				</section>
				<section class="modal-section custom-abilities-manage">
					<h3 class="block-title">Custom abilities</h3>
					<p class="block-hint">Add your own abilities with name, text, description, and cost.</p>
					<button type="button" class="btn-add-custom" onclick={addCustomAbility}>+ Add custom ability</button>
					{#each customAbilities as c, i}
						<div class="custom-ability-card">
							<div class="custom-ability-header">
								<span class="custom-ability-id">{c.id}</span>
								<button type="button" class="btn-remove-custom" aria-label="Remove" onclick={() => removeCustomAbility(i)}>×</button>
							</div>
							<div class="custom-ability-fields">
								<label class="field-label">Name</label>
								<input type="text" class="field-input" placeholder="Ability name" value={c.label} oninput={(e) => updateCustomAbility(i, { label: (e.target as HTMLInputElement).value })} />
								<label class="field-label">Text</label>
								<input type="text" class="field-input" placeholder="Short text or tagline" value={c.text ?? ''} oninput={(e) => updateCustomAbility(i, { text: (e.target as HTMLInputElement).value })} />
								<label class="field-label">Description</label>
								<textarea class="field-textarea" placeholder="Full description" value={c.description} oninput={(e) => updateCustomAbility(i, { description: (e.target as HTMLTextAreaElement).value })}></textarea>
								<label class="field-label">Cost</label>
								<input type="number" min="0" class="field-input field-input-cost" value={c.cost} oninput={(e) => updateCustomAbility(i, { cost: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
							</div>
						</div>
					{/each}
				</section>
				<section class="modal-section custom-abilities-manage">
					<h3 class="block-title">Custom enhancements</h3>
					<p class="block-hint">Add your own enhancements with name, text, description, and cost.</p>
					<button type="button" class="btn-add-custom" onclick={addCustomEnhancement}>+ Add custom enhancement</button>
					{#each customEnhancements as c, i}
						<div class="custom-ability-card">
							<div class="custom-ability-header">
								<span class="custom-ability-id">{c.id}</span>
								<button type="button" class="btn-remove-custom" aria-label="Remove" onclick={() => removeCustomEnhancement(i)}>×</button>
							</div>
							<div class="custom-ability-fields">
								<label class="field-label">Name</label>
								<input type="text" class="field-input" placeholder="Enhancement name" value={c.label} oninput={(e) => updateCustomEnhancement(i, { label: (e.target as HTMLInputElement).value })} />
								<label class="field-label">Text</label>
								<input type="text" class="field-input" placeholder="Short text or tagline" value={c.text ?? ''} oninput={(e) => updateCustomEnhancement(i, { text: (e.target as HTMLInputElement).value })} />
								<label class="field-label">Description</label>
								<textarea class="field-textarea" placeholder="Full description" value={c.description} oninput={(e) => updateCustomEnhancement(i, { description: (e.target as HTMLTextAreaElement).value })}></textarea>
								<label class="field-label">Cost</label>
								<input type="number" min="0" class="field-input field-input-cost" value={c.cost} oninput={(e) => updateCustomEnhancement(i, { cost: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
							</div>
						</div>
					{/each}
				</section>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-build" onclick={() => (buildModalOpen = false)}>Done</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.builder {
		max-width: 56rem;
	}
	.builder-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.back-link {
		color: #0066cc;
		text-decoration: none;
	}
	.back-link:hover {
		text-decoration: underline;
	}
	.toolbar-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.btn-build {
		padding: 0.4rem 0.75rem;
		background: #2ecc71;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}
	.btn-build:hover {
		background: #27ae60;
	}
	.btn-delete {
		padding: 0.4rem 0.75rem;
		background: transparent;
		color: #c0392b;
		border: 1px solid #c0392b;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn-delete:hover {
		background: #fdeaea;
	}

	.sheet.wireframe {
		background: #f0f0f0;
		border: 2px solid #bbb;
		border-radius: 8px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.sheet.wireframe .block {
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}
	.block-label,
	.block-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: #333;
		margin: 0 0 0.35rem 0;
	}
	.block-title {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}
	.name-input {
		width: 100%;
		max-width: none;
		font-size: 1.125rem;
		padding: 0.5rem 0.6rem;
	}
	.notes-label {
		display: block;
		margin-top: 1rem;
	}
	.field-textarea {
		min-height: 4rem;
		max-width: none;
		resize: vertical;
		width: 100%;
		padding: 0.35rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.95rem;
		background: #fff;
	}
	.field-input:not(.name-input),
	.attr-input,
	.skill-input {
		width: 100%;
		max-width: 3.5rem;
		padding: 0.35rem 0.4rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.95rem;
		background: #fff;
	}
	.field-input:focus,
	.field-textarea:focus,
	.attr-input:focus,
	.skill-input:focus,
	.stat-big:focus {
		outline: none;
		border-color: #2ecc71;
	}
	.stat-display {
		display: inline-flex;
		align-items: baseline;
		gap: 0.2rem;
	}
	.stat-big {
		width: 3rem;
		text-align: center;
		padding: 0.4rem 0.25rem;
		border: 1px solid #bbb;
		border-radius: 4px;
		font-size: 1.5rem;
		font-weight: 600;
		background: #fff;
	}
	.stat-big-hp {
		width: 5.5rem;
		font-size: 1.25rem;
	}
	.stat-big-fate {
		width: 4.5rem;
		min-width: 4.5rem;
	}
	.stat-small {
		font-size: 0.9rem;
		color: #666;
	}
	.stat-max-inline {
		font-size: 0.9rem;
		color: #666;
		background: transparent;
		border: none;
		border-bottom: 1px solid transparent;
		width: 2.25rem;
		min-width: 2.25rem;
		text-align: center;
		padding: 0;
		-moz-appearance: textfield;
	}
	.stat-display-hp .stat-max-inline {
		min-width: 4.5rem;
		width: 4.5rem;
	}
	.stat-max-inline::-webkit-outer-spin-button,
	.stat-max-inline::-webkit-inner-spin-button {
		opacity: 0;
	}
	.stat-max-inline:focus {
		outline: none;
		border-bottom-color: #2ecc71;
		font-weight: normal;
	}
	.attributes-separator {
		background: #e8e8e8;
		border: 2px solid #bbb;
		border-radius: 6px;
		padding: 1rem;
	}

	.top-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.25rem;
	}
	.name-notes {
		min-width: 0;
	}
	.stats-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.stat-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.stat-row-hp {
		/* HP gets its own row; stat-display-hp already has wider input */
	}
	.stat-row-fate {
		/* Fate on its own line below HP and XP (desktop) */
	}
	.middle-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: 1rem;
	}
	.attributes-block {
		min-width: 0;
	}
	.attr-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.attr-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.attr-label {
		font-size: 0.9rem;
		font-weight: normal;
	}
	.skills-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		min-width: 0;
	}
	.skill-block {
		min-width: 0;
	}
	.skill-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.skill-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.skill-label {
		font-size: 0.85rem;
		font-weight: normal;
	}
	.bottom-row {
		min-width: 0;
	}
	.abilities-block {
		min-width: 0;
	}
	.enhancements-block {
		min-width: 0;
		margin-top: 0.5rem;
	}
	.ability-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ability-row {
		margin-bottom: 0.5rem;
	}
	.ability-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		font-size: 0.9rem;
	}
	.ability-btn:hover:not(:disabled) {
		text-decoration: underline;
	}
	.ability-btn:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}
	.ability-taken {
		font-weight: 600;
	}
	.ability-name {
		font-weight: 600;
		font-size: 0.95rem;
		display: block;
	}
	.ability-cost {
		font-size: 0.8rem;
		color: #666;
		font-weight: normal;
	}
	.ability-desc {
		font-size: 0.8rem;
		color: #555;
		margin: 0.25rem 0 0 0;
		line-height: 1.35;
	}
	.ability-list-builder .ability-desc {
		margin: 0.15rem 0 0 1rem;
	}
	.ability-text {
		font-size: 0.85rem;
		color: #666;
		margin: 0.2rem 0 0 0;
		font-style: italic;
	}
	.ability-empty {
		font-size: 0.9rem;
		color: #888;
		margin: 0;
		font-style: italic;
	}
	.autosave-note {
		font-size: 0.8rem;
		color: #888;
		margin-top: 1rem;
	}

	.custom-abilities-manage {
		background: #e8e8e8;
		border: 2px solid #bbb;
		border-radius: 6px;
		padding: 1rem;
	}
	.custom-abilities-manage .block-hint {
		font-size: 0.85rem;
		color: #555;
		margin: 0 0 0.75rem 0;
	}
	.btn-add-custom {
		display: block;
		margin-bottom: 1rem;
		padding: 0.4rem 0.75rem;
		background: #2ecc71;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}
	.btn-add-custom:hover {
		background: #27ae60;
	}
	.custom-ability-card {
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-bottom: 0.75rem;
	}
	.custom-ability-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.custom-ability-id {
		font-size: 0.8rem;
		color: #666;
		font-family: monospace;
	}
	.btn-remove-custom {
		background: transparent;
		border: none;
		color: #c0392b;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0 0.25rem;
	}
	.btn-remove-custom:hover {
		background: #fdeaea;
		border-radius: 4px;
	}
	.custom-ability-fields {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.custom-ability-fields .field-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #444;
		margin: 0.25rem 0 0 0;
	}
	.custom-ability-fields .field-label:first-of-type {
		margin-top: 0;
	}
	.custom-ability-fields .field-input,
	.custom-ability-fields .field-textarea {
		width: 100%;
	}
	.field-input-cost {
		width: 4rem;
	}

	/* Mobile: collapse to single column */
	@media (max-width: 768px) {
		.top-row {
			grid-template-columns: 1fr;
		}
		.stats-col {
			width: 100%;
		}
		.middle-row {
			grid-template-columns: 1fr;
		}
		.skills-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1rem;
		overflow-y: auto;
		z-index: 100;
	}
	.modal-content {
		background: #f5f5f5;
		border: 2px solid #999;
		border-radius: 8px;
		width: 100%;
		max-width: 42rem;
		max-height: calc(100vh - 2rem);
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
		margin: auto;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 2px solid #bbb;
		background: #fff;
		border-radius: 6px 6px 0 0;
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	.modal-close {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		color: #666;
	}
	.modal-close:hover {
		color: #000;
	}
	.modal-body {
		padding: 1rem 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.modal-section {
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}
	.modal-section.attributes-separator {
		background: #e8e8e8;
		border: 2px solid #bbb;
	}
	.modal-stat-row {
		/* Each stat (HP, XP, Fate) on its own line in the modal */
	}
	.modal-stat-row-fate {
		margin-top: 0.25rem;
	}
	.modal-section .field-input.full,
	.modal-section .field-textarea.full {
		max-width: none;
	}
	.modal-footer {
		padding: 1rem 1.25rem;
		border-top: 2px solid #bbb;
		background: #fff;
		border-radius: 0 0 6px 6px;
	}
	.points-hint {
		font-size: 0.8rem;
		color: #666;
		margin: 0 0 0.5rem 0;
	}
</style>
