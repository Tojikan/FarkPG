<script lang="ts">
	import type { CharacterData, Theme } from '$lib/data/types';
	import {
		getHealthMax,
		getResourceLabel,
		syncDerivedStats
	} from '$lib/data/character';

	interface Props {
		theme: Theme;
		characterName: string;
		data: CharacterData;
		readonly?: boolean;
		onsave?: (payload: { name: string; data: CharacterData }) => void;
	}

	let {
		theme,
		characterName = $bindable(''),
		data = $bindable(),
		readonly = false,
		onsave
	}: Props = $props();

	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function clampAttribute(id: string, value: number) {
		const attr = theme.attributes.find((a) => a.id === id);
		if (!attr) return value;
		return Math.max(attr.min, Math.min(attr.max, value));
	}

	function updateAttribute(id: string, raw: number) {
		if (readonly) return;
		const value = clampAttribute(id, raw);
		data = syncDerivedStats(
			{
				...data,
				attributes: { ...data.attributes, [id]: value }
			},
			theme
		);
		scheduleSave();
	}

	function updateSkill(catId: string, skillId: string, raw: number) {
		if (readonly) return;
		const value = Math.max(0, raw);
		data = {
			...data,
			skills: {
				...data.skills,
				[catId]: { ...(data.skills[catId] ?? {}), [skillId]: value }
			}
		};
		scheduleSave();
	}

	function updateHealthCurrent(raw: number) {
		if (readonly) return;
		const max = getHealthMax(data, theme);
		data = { ...data, health: { current: Math.max(0, Math.min(max, raw)), max } };
		scheduleSave();
	}

	function updateResourceCurrent(raw: number) {
		if (readonly) return;
		const max = data.fate.max;
		data = { ...data, fate: { current: Math.max(0, Math.min(max, raw)), max } };
		scheduleSave();
	}

	function updateNotes(value: string) {
		if (readonly) return;
		data = { ...data, notes: value };
		scheduleSave();
	}

	function toggleEquipped(index: number) {
		if (readonly) return;
		const inventory = [...(data.inventory ?? [])];
		const entry = inventory[index];
		if (!entry) return;
		inventory[index] = { ...entry, equipped: !entry.equipped };
		data = { ...data, inventory };
		scheduleSave();
	}

	function scheduleSave() {
		if (!onsave || readonly) return;
		saveStatus = 'saving';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			const synced = syncDerivedStats(data, theme);
			data = synced;
			onsave?.({ name: characterName, data: synced });
			saveStatus = 'saved';
			setTimeout(() => {
				if (saveStatus === 'saved') saveStatus = 'idle';
			}, 1500);
		}, 600);
	}

	const resourceLabel = $derived(getResourceLabel(theme));
	const healthMax = $derived(getHealthMax(data, theme));
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex-1">
			<label class="field-label" for="charName">Character name</label>
			<input
				id="charName"
				class="field-input max-w-md"
				bind:value={characterName}
				disabled={readonly}
				oninput={() => scheduleSave()}
			/>
		</div>
		<div class="text-sm text-neutral-500">
			{#if saveStatus === 'saving'}Saving…
			{:else if saveStatus === 'saved'}Saved
			{:else if saveStatus === 'error'}Save failed
			{/if}
		</div>
	</div>

	<section class="card">
		<h2 class="mb-3 text-lg font-semibold">Attributes</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each theme.attributes as attr}
				<label class="block">
					<span class="field-label">{attr.label} ({attr.abbr})</span>
					<input
						class="field-input"
						type="number"
						min={attr.min}
						max={attr.max}
						value={data.attributes[attr.id] ?? attr.default}
						disabled={readonly}
						oninput={(e) => updateAttribute(attr.id, Number(e.currentTarget.value))}
					/>
				</label>
			{/each}
		</div>
	</section>

	<section class="card">
		<h2 class="mb-3 text-lg font-semibold">Resources</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<label class="block">
				<span class="field-label">Health (max {healthMax})</span>
				<input
					class="field-input"
					type="number"
					min="0"
					max={healthMax}
					value={data.health?.current ?? healthMax}
					disabled={readonly}
					oninput={(e) => updateHealthCurrent(Number(e.currentTarget.value))}
				/>
			</label>
			{#if theme.id === 'znz'}
				<label class="block">
					<span class="field-label">Movement</span>
					<input class="field-input" type="number" value={data.znz?.movement ?? 20} disabled />
				</label>
				<label class="block">
					<span class="field-label">Action Points (max {data.znz?.actionPoints?.max ?? 18})</span>
					<input
						class="field-input"
						type="number"
						min="0"
						max={data.znz?.actionPoints?.max ?? 18}
						value={data.znz?.actionPoints?.current ?? 18}
						disabled={readonly}
						oninput={(e) => {
							if (readonly) return;
							const max = data.znz?.actionPoints?.max ?? 18;
							const current = Math.max(0, Math.min(max, Number(e.currentTarget.value)));
							data = {
								...data,
								znz: {
									...data.znz,
									actionPoints: { current, max }
								}
							};
							scheduleSave();
						}}
					/>
				</label>
			{:else}
				<label class="block">
					<span class="field-label">{resourceLabel} (max {data.fate.max})</span>
					<input
						class="field-input"
						type="number"
						min="0"
						max={data.fate.max}
						value={data.fate.current}
						disabled={readonly}
						oninput={(e) => updateResourceCurrent(Number(e.currentTarget.value))}
					/>
				</label>
			{/if}
			<label class="block">
				<span class="field-label">XP</span>
				<input
					class="field-input"
					type="number"
					min="0"
					value={data.xp ?? 0}
					disabled={readonly}
					oninput={(e) => {
						if (readonly) return;
						data = { ...data, xp: Math.max(0, Number(e.currentTarget.value)) };
						scheduleSave();
					}}
				/>
			</label>
		</div>
	</section>

	{#each Object.values(theme.skills) as category}
		<section class="card">
			<h2 class="mb-3 text-lg font-semibold">{category.label}</h2>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each category.skills as skill}
					<label class="block">
						<span class="field-label">{skill.label}</span>
						<input
							class="field-input"
							type="number"
							min="0"
							value={data.skills[category.id]?.[skill.id] ?? 0}
							disabled={readonly}
							oninput={(e) => updateSkill(category.id, skill.id, Number(e.currentTarget.value))}
						/>
					</label>
				{/each}
			</div>
		</section>
	{/each}

	{#if theme.abilities.length > 0}
		<section class="card">
			<h2 class="mb-3 text-lg font-semibold">Abilities</h2>
			<div class="space-y-2">
				{#each theme.abilities as ability}
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={(data.abilities[ability.id] ?? 0) > 0}
							disabled={readonly}
							onchange={(e) => {
								if (readonly) return;
								data = {
									...data,
									abilities: {
										...data.abilities,
										[ability.id]: e.currentTarget.checked ? 1 : 0
									}
								};
								scheduleSave();
							}}
						/>
						<span>{ability.label}</span>
					</label>
				{/each}
			</div>
		</section>
	{/if}

	{#if (data.inventory?.length ?? 0) > 0}
		<section class="card">
			<h2 class="mb-3 text-lg font-semibold">Inventory</h2>
			<ul class="space-y-2">
				{#each data.inventory ?? [] as entry, index}
					<li class="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2">
						<span>{entry.label ?? entry.itemId} × {entry.quantity}</span>
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={entry.equipped}
								disabled={readonly}
								onchange={() => toggleEquipped(index)}
							/>
							Equipped
						</label>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="card">
		<h2 class="mb-3 text-lg font-semibold">Notes</h2>
		<textarea
			class="field-input min-h-32"
			value={data.notes ?? ''}
			disabled={readonly}
			oninput={(e) => updateNotes(e.currentTarget.value)}
		></textarea>
	</section>
</div>
