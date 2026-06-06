<script lang="ts">
	import AttributeCategoryIcon from '$lib/components/builder/AttributeCategoryIcon.svelte';
	import AbilityModal from '$lib/components/sheet/AbilityModal.svelte';
	import ItemModal from '$lib/components/sheet/ItemModal.svelte';
	import SheetConfigModal from '$lib/components/sheet/SheetConfigModal.svelte';
	import {
		getHealthMax,
		getResourceLabel,
		syncDerivedStats
	} from '$lib/data/character';
	import { knowledgeLabel, SKILL_RANK_CAP } from '$lib/data/themes/core';
	import { PORTRAIT_ACCEPT, portraitPublicUrl } from '$lib/data/portrait';
	import {
		emptyInventoryEntry,
		getItemDisplayStats,
		itemDisplayName,
		itemImageUrl,
		itemKindMeta,
		normalizeInventoryEntry,
		sanitizeInventoryEntry
	} from '$lib/data/items';
	import {
		CATEGORY_STYLES,
		DEFAULT_XP_MAX,
		emptyCustomAbility,
		getDisplayAbilities,
		getEquippedItems,
		MAX_ABILITY_SLOTS,
		MAX_EQUIPMENT_SLOTS,
		MAX_INVENTORY_SLOTS
	} from '$lib/data/sheet';
	import type { CharacterData, InventoryEntry, Theme } from '$lib/data/types';

	interface Props {
		theme: Theme;
		characterId: string;
		characterName: string;
		data: CharacterData;
		readonly?: boolean;
		onsave?: (payload: { name: string; data: CharacterData }) => void;
	}

	let {
		theme,
		characterId,
		characterName = $bindable(''),
		data = $bindable(),
		readonly = false,
		onsave
	}: Props = $props();

	type SheetTab = 'equipped' | 'inventory' | 'abilities' | 'attributes';
	let activeTab = $state<SheetTab>('equipped');
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	let itemModalOpen = $state(false);
	let itemModalEntry = $state<InventoryEntry | null>(null);
	let itemModalIndex = $state<number | null>(null);
	let itemModalShowEquip = $state(false);

	let abilityModalOpen = $state(false);
	let abilityModalDraft = $state<{
		id: string;
		label: string;
		description: string;
		imagePath?: string;
		imageUpdatedAt?: string;
	} | null>(null);

	let configModalOpen = $state(false);

	let portraitInput = $state<HTMLInputElement | null>(null);
	let portraitUploading = $state(false);
	let portraitError = $state('');

	const portraitUrl = $derived(
		data.znz?.portraitPath
			? portraitPublicUrl(data.znz.portraitPath, data.znz.portraitUpdatedAt)
			: null
	);

	const categories = $derived(Object.values(theme.skills));
	const resourceLabel = $derived(getResourceLabel(theme));
	const derivedHealthMax = $derived(getHealthMax(data, theme));
	const healthMax = $derived(data.health?.max ?? derivedHealthMax);
	const apMax = $derived(data.znz?.actionPoints?.max ?? 18);
	const xpMax = $derived(data.xpMax ?? DEFAULT_XP_MAX);
	const movement = $derived(data.znz?.movement ?? 20);

	const inventory = $derived(data.inventory ?? []);
	const equippedItems = $derived(getEquippedItems(inventory));
	const equipmentSlotsMax = $derived(data.znz?.equipmentSlotsMax ?? MAX_EQUIPMENT_SLOTS);
	const inventorySlotsMax = $derived(data.znz?.inventorySlotsMax ?? MAX_INVENTORY_SLOTS);
	const displayAbilities = $derived(getDisplayAbilities(data, theme));

	function scheduleSave() {
		if (!onsave || readonly) return;
		saveStatus = 'saving';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			const synced = syncDerivedStats(data, theme);
			data = synced;
			try {
				await onsave({ name: characterName, data: synced });
				saveStatus = 'saved';
				setTimeout(() => {
					if (saveStatus === 'saved') saveStatus = 'idle';
				}, 1500);
			} catch {
				saveStatus = 'error';
			}
		}, 600);
	}

	function bumpAttribute(attrId: string, delta: number) {
		if (readonly) return;
		const attr = theme.attributes.find((a) => a.id === attrId);
		if (!attr) return;
		const current = data.attributes[attrId] ?? attr.default;
		const next = Math.max(attr.min, Math.min(attr.max, current + delta));
		if (next === current) return;
		data = { ...data, attributes: { ...data.attributes, [attrId]: next } };
		scheduleSave();
	}

	function setSkillRank(categoryId: string, skillId: string, value: number) {
		if (readonly) return;
		const rank = Math.max(0, Math.min(SKILL_RANK_CAP, Math.floor(value)));
		data = {
			...data,
			skills: {
				...data.skills,
				[categoryId]: { ...data.skills[categoryId], [skillId]: rank }
			}
		};
		scheduleSave();
	}

	function bumpKnowledge(lineId: string, delta: number) {
		if (readonly) return;
		const lines = data.znz?.knowledgeLines ?? [];
		data = {
			...data,
			znz: {
				...data.znz,
				knowledgeLines: lines.map((line) =>
					line.id === lineId
						? { ...line, rank: Math.max(0, Math.min(SKILL_RANK_CAP, line.rank + delta)) }
						: line
				)
			}
		};
		scheduleSave();
	}

	function bumpCustomSkill(skillId: string, delta: number) {
		if (readonly) return;
		const skills = data.znz?.customSkills ?? [];
		data = {
			...data,
			znz: {
				...data.znz,
				customSkills: skills.map((skill) =>
					skill.id === skillId
						? { ...skill, rank: Math.max(0, Math.min(SKILL_RANK_CAP, skill.rank + delta)) }
						: skill
				)
			}
		};
		scheduleSave();
	}

	function setHealthCurrent(value: number) {
		if (readonly) return;
		data = {
			...data,
			health: { current: Math.max(0, Math.min(healthMax, value)), max: healthMax }
		};
		scheduleSave();
	}

	function setHealthMax(value: number) {
		if (readonly) return;
		const max = Math.max(1, value);
		const current = data.health?.current ?? max;
		data = {
			...data,
			health: { current: Math.min(current, max), max }
		};
		scheduleSave();
	}

	function setApCurrent(value: number) {
		if (readonly) return;
		data = {
			...data,
			znz: { ...data.znz, actionPoints: { current: Math.max(0, Math.min(apMax, value)), max: apMax } }
		};
		scheduleSave();
	}

	function setApMax(value: number) {
		if (readonly) return;
		const max = Math.max(1, value);
		const current = data.znz?.actionPoints?.current ?? max;
		data = {
			...data,
			znz: { ...data.znz, actionPoints: { current: Math.min(current, max), max } }
		};
		scheduleSave();
	}

	function setXp(value: number) {
		if (readonly) return;
		data = { ...data, xp: Math.max(0, value) };
		scheduleSave();
	}

	function setXpMax(value: number) {
		if (readonly) return;
		data = { ...data, xpMax: Math.max(1, value) };
		scheduleSave();
	}

	function setMovement(value: number) {
		if (readonly) return;
		data = { ...data, znz: { ...data.znz, movement: Math.max(0, value) } };
		scheduleSave();
	}

	function saveSheetConfig(values: { equipmentSlotsMax: number; inventorySlotsMax: number }) {
		if (readonly) return;
		data = {
			...data,
			znz: {
				...data.znz,
				equipmentSlotsMax: values.equipmentSlotsMax,
				inventorySlotsMax: values.inventorySlotsMax
			}
		};
		scheduleSave();
	}

	function openPortraitPicker() {
		if (readonly || portraitUploading) return;
		portraitInput?.click();
	}

	async function handlePortraitSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || readonly) return;

		portraitError = '';
		portraitUploading = true;
		try {
			const body = new FormData();
			body.append('file', file);
			const res = await fetch(`/characters/${characterId}/portrait`, {
				method: 'POST',
				body
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(payload.message ?? payload.error ?? 'Upload failed');
			}
			data = {
				...data,
				znz: {
					...data.znz,
					portraitPath: payload.portraitPath,
					portraitUpdatedAt: payload.portraitUpdatedAt
				}
			};
		} catch (err) {
			portraitError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			portraitUploading = false;
		}
	}

	async function removePortrait() {
		if (readonly || portraitUploading || !data.znz?.portraitPath) return;
		portraitError = '';
		portraitUploading = true;
		try {
			const res = await fetch(`/characters/${characterId}/portrait`, { method: 'DELETE' });
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.message ?? payload.error ?? 'Remove failed');
			}
			data = {
				...data,
				znz: {
					...data.znz,
					portraitPath: undefined,
					portraitUpdatedAt: undefined
				}
			};
		} catch (err) {
			portraitError = err instanceof Error ? err.message : 'Remove failed';
		} finally {
			portraitUploading = false;
		}
	}

	function openAddItem(equip = false) {
		if (readonly) return;
		const entry = emptyInventoryEntry(equip);
		itemModalEntry = entry;
		itemModalIndex = null;
		itemModalShowEquip = false;
		itemModalOpen = true;
	}

	function openEditItem(index: number, fromInventory = false) {
		itemModalEntry = normalizeInventoryEntry(
			JSON.parse(JSON.stringify(inventory[index])) as InventoryEntry
		);
		itemModalIndex = index;
		itemModalShowEquip = fromInventory && !inventory[index].equipped;
		itemModalOpen = true;
	}

	function toggleItemEquipped(index: number, equipped: boolean) {
		if (readonly) return;
		const list = [...(data.inventory ?? [])];
		list[index] = { ...list[index], equipped };
		data = { ...data, inventory: list };
		scheduleSave();
	}

	function itemOverlayStat(entry: InventoryEntry) {
		const stats = getItemDisplayStats(entry);
		if (stats.length === 0) return null;
		return stats.find((s) => s.key === 'AMMO' || s.key === 'DURABILITY') ?? stats[0];
	}

	function saveItem(entry: InventoryEntry) {
		const list = [...(data.inventory ?? [])];
		const cleaned = sanitizeInventoryEntry(entry);
		if (itemModalIndex != null) {
			list[itemModalIndex] = cleaned;
		} else {
			list.push(cleaned);
		}
		data = { ...data, inventory: list };
		scheduleSave();
	}

	function deleteItem() {
		if (itemModalIndex == null) return;
		const list = [...(data.inventory ?? [])];
		list.splice(itemModalIndex, 1);
		data = { ...data, inventory: list };
		scheduleSave();
	}

	function openAddAbility() {
		if (readonly) return;
		abilityModalDraft = emptyCustomAbility();
		abilityModalOpen = true;
	}

	function openEditAbility(id: string, source: 'theme' | 'custom') {
		if (source === 'theme') return;
		const existing = (data.custom?.abilities ?? []).find((ab) => ab.id === id);
		if (!existing) return;
		abilityModalDraft = {
			id: existing.id,
			label: existing.label,
			description: existing.description,
			imagePath: existing.imagePath,
			imageUpdatedAt: existing.imageUpdatedAt
		};
		abilityModalOpen = true;
	}

	function saveAbility(ability: {
		id: string;
		label: string;
		description: string;
		imagePath?: string;
		imageUpdatedAt?: string;
	}) {
		const list = [...(data.custom?.abilities ?? [])];
		const index = list.findIndex((ab) => ab.id === ability.id);
		const entry = {
			id: ability.id,
			label: ability.label,
			description: ability.description,
			imagePath: ability.imagePath,
			imageUpdatedAt: ability.imageUpdatedAt
		};
		if (index >= 0) list[index] = entry;
		else list.push(entry);
		data = { ...data, custom: { ...data.custom, abilities: list } };
		scheduleSave();
	}

	function deleteAbility() {
		if (!abilityModalDraft) return;
		const list = (data.custom?.abilities ?? []).filter((ab) => ab.id !== abilityModalDraft!.id);
		data = { ...data, custom: { ...data.custom, abilities: list } };
		scheduleSave();
	}
</script>

{#snippet attributesPanel()}
	<div class="sidebar-title">
		<span>Attributes &amp; Skills</span>
	</div>

	{#each categories as cat}
		{@const style = CATEGORY_STYLES[cat.id] ?? CATEGORY_STYLES.body}
		{@const attrVal = data.attributes[cat.id] ?? 1}
		<section class="attr-block" style="--accent: {style.accent}; --accent-bg: {style.bg}">
			<div class="attr-header">
				<div class="attr-title">
					<AttributeCategoryIcon categoryId={cat.id} />
					<span>{cat.label.toUpperCase()}</span>
				</div>
				<div class="attr-stepper">
					<button type="button" class="mini-btn" disabled={readonly} onclick={() => bumpAttribute(cat.id, -1)}>−</button>
					<span class="attr-value">{attrVal}</span>
					<button type="button" class="mini-btn" disabled={readonly} onclick={() => bumpAttribute(cat.id, 1)}>+</button>
				</div>
			</div>

			<ul class="skill-list">
				{#each cat.skills as skill}
					{#if skill.kind !== 'knowledge'}
						{@const rank = data.skills[cat.id]?.[skill.id] ?? 0}
						<li class="skill-line">
							<span class="skill-dot"></span>
							<span class="skill-name">{skill.label}</span>
							<div class="skill-stepper">
								<button
									type="button"
									class="mini-btn"
									disabled={readonly || rank <= 0}
									onclick={() => setSkillRank(cat.id, skill.id, rank - 1)}
								>−</button>
								<span class="skill-rank">{rank}</span>
								<button
									type="button"
									class="mini-btn"
									disabled={readonly || rank >= SKILL_RANK_CAP}
									onclick={() => setSkillRank(cat.id, skill.id, rank + 1)}
								>+</button>
							</div>
						</li>
					{/if}
				{/each}

				{#if cat.id === 'mind'}
					{#each data.znz?.knowledgeLines ?? [] as line}
						<li class="skill-line skill-line-sub">
							<span class="skill-dot"></span>
							<span class="skill-name">{knowledgeLabel(line.presetId, line.detail)}</span>
							<div class="skill-stepper">
								<button type="button" class="mini-btn" disabled={readonly || line.rank <= 0} onclick={() => bumpKnowledge(line.id, -1)}>−</button>
								<span class="skill-rank">{line.rank}</span>
								<button type="button" class="mini-btn" disabled={readonly || line.rank >= SKILL_RANK_CAP} onclick={() => bumpKnowledge(line.id, 1)}>+</button>
							</div>
						</li>
					{/each}
				{/if}

				{#each (data.znz?.customSkills ?? []).filter((s) => s.attribute === cat.id) as custom}
					<li class="skill-line skill-line-sub">
						<span class="skill-dot"></span>
						<span class="skill-name">{custom.label || 'Custom skill'}</span>
						<div class="skill-stepper">
							<button type="button" class="mini-btn" disabled={readonly || custom.rank <= 0} onclick={() => bumpCustomSkill(custom.id, -1)}>−</button>
							<span class="skill-rank">{custom.rank}</span>
							<button type="button" class="mini-btn" disabled={readonly || custom.rank >= SKILL_RANK_CAP} onclick={() => bumpCustomSkill(custom.id, 1)}>+</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/snippet}

{#snippet itemCard(entry: InventoryEntry, index: number, panel: 'equipment' | 'inventory')}
	{@const kind = itemKindMeta(entry)}
	{@const image = itemImageUrl(entry)}
	{@const stats = getItemDisplayStats(entry)}
	{@const overlay = itemOverlayStat(entry)}
	{@const features = entry.features ?? {}}
	{@const showQty = features.hasQuantity && (entry.quantity ?? 1) > 0}
	<article class="item-card" style="--item-accent: {kind.color}">
		<div class="item-card-media">
			{#if showQty}
				<span class="item-qty-badge">{entry.quantity}</span>
			{/if}
			<div class="item-card-image">
				{#if image}
					<img src={image} alt="" class="item-thumb" />
				{:else}
					<i class="fa-solid fa-cube item-placeholder" aria-hidden="true"></i>
				{/if}
			</div>
			{#if overlay}
				<div class="item-overlay-stat">
					<i class={overlay.icon} aria-hidden="true"></i>
					<span>{overlay.value}</span>
				</div>
			{/if}
		</div>

		<div class="item-card-body">
			<div class="item-card-head">
				<div class="item-card-title-row">
					<h4>{itemDisplayName(entry)}</h4>
					<span class="item-type-badge">{kind.label}</span>
				</div>
				{#if entry.description}
					<p class="item-desc">{entry.description}</p>
				{/if}
			</div>

			{#if stats.length > 0}
				<ul class="item-stat-list">
					{#each stats as stat (stat.key)}
						<li class="item-stat-row">
							<i class={stat.icon} aria-hidden="true"></i>
							<span class="stat-key">{stat.key}</span>
							<span class="stat-val">{stat.value}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="item-card-actions">
				{#if !readonly}
					{#if panel === 'equipment'}
						<button
							type="button"
							class="item-action-primary"
							onclick={() => toggleItemEquipped(index, false)}
						>
							<i class="fa-solid fa-shirt" aria-hidden="true"></i>
							Unequip
						</button>
					{:else if (entry.itemKind ?? 'equipment') === 'equipment'}
						<button
							type="button"
							class="item-action-primary"
							onclick={() => toggleItemEquipped(index, true)}
						>
							<i class="fa-solid fa-vest" aria-hidden="true"></i>
							Equip
						</button>
					{:else}
						<button
							type="button"
							class="item-action-primary"
							onclick={() => openEditItem(index, true)}
						>
							<i class="fa-solid fa-hand-fist" aria-hidden="true"></i>
							Use
						</button>
					{/if}
				{/if}
				<button
					type="button"
					class="item-action-edit"
					aria-label="Edit item"
					onclick={() => openEditItem(index, panel === 'inventory')}
				>
					<i class="fa-solid fa-pencil" aria-hidden="true"></i>
				</button>
			</div>
		</div>
	</article>
{/snippet}

{#snippet equippedPanel()}
	<section class="panel">
		<div class="panel-header">
			<h3>Equipment</h3>
			<span class="panel-meta">Slots: {equippedItems.length}/{equipmentSlotsMax}</span>
		</div>
		<div class="item-card-row">
			{#each inventory as entry, index}
				{#if entry.equipped}
					{@render itemCard(entry, index, 'equipment')}
				{/if}
			{/each}

			{#if !readonly && equippedItems.length < equipmentSlotsMax}
				<button type="button" class="empty-slot item-card" onclick={() => openAddItem(true)}>
					<span class="empty-plus">+</span>
					<span>Empty slot</span>
				</button>
			{/if}
		</div>
	</section>
{/snippet}

{#snippet inventoryPanel()}
	<section class="panel">
		<div class="panel-header">
			<h3>Inventory</h3>
			<span class="panel-meta">Slots: {inventory.length}/{inventorySlotsMax}</span>
		</div>
		<div class="item-card-row">
			{#each inventory as entry, index}
				{#if !entry.equipped}
					{@render itemCard(entry, index, 'inventory')}
				{/if}
			{/each}

			{#if !readonly && inventory.length < inventorySlotsMax}
				<button type="button" class="empty-slot item-card" onclick={() => openAddItem(false)}>
					<span class="empty-plus">+</span>
					<span>Add item</span>
				</button>
			{/if}
		</div>
	</section>
{/snippet}

{#snippet abilitiesPanel()}
	<section class="panel">
		<div class="panel-header">
			<h3>Abilities</h3>
		</div>
		<div class="card-grid">
			{#each displayAbilities as ab}
				<article class="ability-card ability-card-lg">
					<div class="ability-icon">
						{#if ab.imageUrl}
							<img src={ab.imageUrl} alt="" class="ability-icon-img" />
						{:else}
							<i class={ab.icon} aria-hidden="true"></i>
						{/if}
					</div>
					<div class="ability-body">
						<div class="ability-top">
							<h4>{ab.label}</h4>
						</div>
						<p class="ability-desc">{ab.description}</p>
						{#if ab.details?.length}
							<ul class="ability-details">
								{#each ab.details as detail}
									<li>{detail}</li>
								{/each}
							</ul>
						{/if}
						{#if ab.source === 'theme'}
							<span class="ability-source">From build</span>
						{/if}
					</div>
					{#if ab.source === 'custom'}
						<button type="button" class="card-menu" aria-label="Edit ability" onclick={() => openEditAbility(ab.id, ab.source)}>⋯</button>
					{/if}
				</article>
			{/each}

			{#if !readonly && displayAbilities.length < MAX_ABILITY_SLOTS}
				<button type="button" class="empty-slot" onclick={openAddAbility}>
					<span class="empty-plus">+</span>
					<span>Add ability</span>
				</button>
			{/if}
		</div>
	</section>
{/snippet}

{#snippet notesPanel()}
	<section class="panel notes-panel">
		<div class="panel-header">
			<h3>Notes</h3>
		</div>
		<textarea
			id="sheet-notes"
			class="notes-input"
			value={data.notes ?? ''}
			disabled={readonly}
			oninput={(e) => {
				if (readonly) return;
				data = { ...data, notes: e.currentTarget.value };
				scheduleSave();
			}}
		></textarea>
	</section>
{/snippet}

<div class="sheet-view">
	<button
		type="button"
		class="sheet-config-btn"
		aria-label="Sheet settings"
		onclick={() => (configModalOpen = true)}
	>
		<i class="fa-solid fa-gear" aria-hidden="true"></i>
	</button>

	<header class="sheet-header">
		<div class="header-left">
			<div class="portrait-wrap">
				<button
					type="button"
					class="portrait"
					class:portrait-uploading={portraitUploading}
					disabled={readonly || portraitUploading}
					onclick={openPortraitPicker}
					aria-label={portraitUrl ? 'Change character portrait' : 'Upload character portrait'}
				>
					{#if portraitUrl}
						<img src={portraitUrl} alt="" class="portrait-image" />
					{:else}
						<i class="fa-solid fa-user portrait-placeholder" aria-hidden="true"></i>
					{/if}
					{#if !readonly}
						<span class="portrait-overlay">
							<i class="fa-solid fa-camera" aria-hidden="true"></i>
						</span>
					{/if}
				</button>
				{#if !readonly && portraitUrl}
					<button
						type="button"
						class="portrait-remove"
						disabled={portraitUploading}
						onclick={removePortrait}
						aria-label="Remove portrait"
					>×</button>
				{/if}
				<input
					bind:this={portraitInput}
					type="file"
					class="portrait-file-input"
					accept={PORTRAIT_ACCEPT}
					onchange={handlePortraitSelected}
				/>
			</div>
			<div class="name-block">
				<input
					class="char-name"
					bind:value={characterName}
					disabled={readonly}
					oninput={() => scheduleSave()}
					placeholder="Character name"
					aria-label="Character name"
				/>
				<div class="header-actions">
					{#if portraitError}
						<span class="portrait-error">{portraitError}</span>
					{/if}
					<span class="save-status">
						{#if saveStatus === 'saving'}Saving…
						{:else if saveStatus === 'saved'}Saved
						{:else if saveStatus === 'error'}Save failed
						{/if}
					</span>
				</div>
			</div>
		</div>

		<div class="header-stats">
			<div class="stat-bar stat-hp">
				<div class="stat-bar-top">
					<i class="fa-solid fa-heart" aria-hidden="true"></i>
					<span class="stat-label">HP</span>
					<span class="stat-values">
						<input
							type="number"
							class="stat-input"
							value={data.health?.current ?? healthMax}
							disabled={readonly}
							oninput={(e) => setHealthCurrent(Number(e.currentTarget.value))}
						/>
						/
						<input
							type="number"
							class="stat-input stat-input-max"
							value={healthMax}
							disabled={readonly}
							oninput={(e) => setHealthMax(Number(e.currentTarget.value))}
						/>
					</span>
				</div>
				<div class="bar-track">
					<div
						class="bar-fill"
						style="width: {healthMax > 0 ? ((data.health?.current ?? healthMax) / healthMax) * 100 : 0}%"
					></div>
				</div>
			</div>

			<div class="stat-bar stat-ap">
				<div class="stat-bar-top">
					<i class="fa-solid fa-star" aria-hidden="true"></i>
					<span class="stat-label">{resourceLabel}</span>
					<span class="stat-values">
						<input
							type="number"
							class="stat-input"
							value={data.znz?.actionPoints?.current ?? apMax}
							disabled={readonly}
							oninput={(e) => setApCurrent(Number(e.currentTarget.value))}
						/>
						/
						<input
							type="number"
							class="stat-input stat-input-max"
							value={apMax}
							disabled={readonly}
							oninput={(e) => setApMax(Number(e.currentTarget.value))}
						/>
					</span>
				</div>
				<div class="bar-track">
					<div
						class="bar-fill"
						style="width: {apMax > 0 ? ((data.znz?.actionPoints?.current ?? apMax) / apMax) * 100 : 0}%"
					></div>
				</div>
			</div>

			<div class="stat-bar stat-xp">
				<div class="stat-bar-top">
					<i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
					<span class="stat-label">EXP</span>
					<span class="stat-values">
						<input
							type="number"
							class="stat-input"
							value={data.xp ?? 0}
							disabled={readonly}
							oninput={(e) => setXp(Number(e.currentTarget.value))}
						/>
						/
						<input
							type="number"
							class="stat-input stat-input-max"
							value={xpMax}
							disabled={readonly}
							oninput={(e) => setXpMax(Number(e.currentTarget.value))}
						/>
					</span>
				</div>
				<div class="bar-track">
					<div
						class="bar-fill"
						style="width: {xpMax > 0 ? ((data.xp ?? 0) / xpMax) * 100 : 0}%"
					></div>
				</div>
			</div>

			<div class="stat-move">
				<i class="fa-solid fa-angles-right" aria-hidden="true"></i>
				<span class="stat-label">MOVE</span>
				<input
					type="number"
					class="stat-input stat-input-move"
					value={movement}
					disabled={readonly}
					oninput={(e) => setMovement(Number(e.currentTarget.value))}
				/>
			</div>
		</div>
	</header>

	<div class="sheet-body">
		<aside class="sheet-sidebar sheet-scroll desktop-sidebar">
			{@render attributesPanel()}
		</aside>

		<main class="sheet-main sheet-scroll">
			<div class="main-sections">
				<div class="desktop-sections">
					{@render equippedPanel()}
					{@render inventoryPanel()}
					{@render abilitiesPanel()}
					{@render notesPanel()}
				</div>

				<div class="mobile-sections">
					<nav class="sheet-tabs" aria-label="Sheet sections">
						<button
							type="button"
							class="sheet-tab"
							class:sheet-tab-active={activeTab === 'attributes'}
							onclick={() => (activeTab = 'attributes')}
						>
							<i class="fa-solid fa-list" aria-hidden="true"></i> Attributes &amp; Skills
						</button>
						<button
							type="button"
							class="sheet-tab"
							class:sheet-tab-active={activeTab === 'equipped'}
							onclick={() => (activeTab = 'equipped')}
						>
							<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Equipment
						</button>
						<button
							type="button"
							class="sheet-tab"
							class:sheet-tab-active={activeTab === 'inventory'}
							onclick={() => (activeTab = 'inventory')}
						>
							<i class="fa-solid fa-box-open" aria-hidden="true"></i> Inventory
						</button>
						<button
							type="button"
							class="sheet-tab"
							class:sheet-tab-active={activeTab === 'abilities'}
							onclick={() => (activeTab = 'abilities')}
						>
							<i class="fa-solid fa-star" aria-hidden="true"></i> Abilities
						</button>
					</nav>

					{#if activeTab === 'attributes'}
						<div class="mobile-attributes">
							{@render attributesPanel()}
						</div>
					{:else if activeTab === 'equipped'}
						{@render equippedPanel()}
						{@render notesPanel()}
					{:else if activeTab === 'inventory'}
						{@render inventoryPanel()}
					{:else}
						{@render abilitiesPanel()}
					{/if}
				</div>
			</div>
		</main>
	</div>
</div>

{#if itemModalOpen && itemModalEntry}
	{#key itemModalEntry.itemId}
		<ItemModal
			entry={itemModalEntry}
			{characterId}
			{readonly}
			showEquipButton={itemModalShowEquip}
			onclose={() => (itemModalOpen = false)}
			onsave={saveItem}
			ondelete={itemModalIndex != null && !readonly ? deleteItem : undefined}
		/>
	{/key}
{/if}

{#if abilityModalOpen && abilityModalDraft}
	{#key abilityModalDraft.id}
		<AbilityModal
			ability={abilityModalDraft}
			{characterId}
			{readonly}
			onclose={() => (abilityModalOpen = false)}
			onsave={saveAbility}
			ondelete={!readonly ? deleteAbility : undefined}
		/>
	{/key}
{/if}

{#if configModalOpen}
	{#key `${equipmentSlotsMax}-${inventorySlotsMax}`}
		<SheetConfigModal
			equipmentSlotsMax={equipmentSlotsMax}
			inventorySlotsMax={inventorySlotsMax}
			{readonly}
			onclose={() => (configModalOpen = false)}
			onsave={saveSheetConfig}
		/>
	{/key}
{/if}

<style>
	.sheet-view {
		position: relative;
		background: #141b26;
		color: #e8ecf1;
		border-radius: 0.75rem;
		overflow: hidden;
		min-height: calc(100vh - 11rem);
	}

	.sheet-config-btn {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 2;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid #3a4d66;
		border-radius: 0.375rem;
		color: #8899aa;
		font-size: 0.875rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}

	.sheet-config-btn:hover:not(:disabled) {
		color: #c5d0dc;
		border-color: #5dade2;
		background: rgba(93, 173, 226, 0.1);
	}

	.sheet-config-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.sheet-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		padding: 1rem 1.5rem;
		background: #1a2332;
		border-bottom: 1px solid #2d3a4d;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.portrait-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.portrait {
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 0.375rem;
		background: #243044;
		border: 2px solid #3a4d66;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #8899aa;
		font-size: 1.25rem;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		position: relative;
	}

	.portrait:disabled {
		cursor: default;
		opacity: 0.85;
	}

	.portrait-uploading {
		opacity: 0.65;
	}

	.portrait-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.portrait-placeholder {
		font-size: 1.5rem;
	}

	.portrait-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		opacity: 0;
		transition: opacity 0.15s;
		font-size: 1rem;
	}

	.portrait:hover .portrait-overlay,
	.portrait:focus-visible .portrait-overlay {
		opacity: 1;
	}

	.portrait-remove {
		position: absolute;
		top: -0.35rem;
		right: -0.35rem;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 9999px;
		border: 1px solid #3a4d66;
		background: #922b21;
		color: #fff;
		font-size: 0.85rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	.portrait-file-input {
		display: none;
	}

	.portrait-error {
		color: #e74c3c;
		font-size: 0.7rem;
	}

	.name-block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.char-name {
		background: transparent;
		border: none;
		color: #fff;
		font-size: 1.35rem;
		font-weight: 700;
		padding: 0;
		min-width: 10rem;
	}

	.char-name:focus {
		outline: none;
		border-bottom: 1px solid #c9a227;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
	}

	.header-link {
		color: #5dade2;
		text-decoration: none;
	}

	.save-status {
		color: #8899aa;
	}

	.header-stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		flex: 1;
		min-width: 0;
	}

	.stat-bar {
		min-width: 9rem;
		flex: 1 1 10rem;
		max-width: none;
	}

	.stat-bar-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		margin-bottom: 0.35rem;
	}

	.stat-label {
		font-weight: 700;
		letter-spacing: 0.06em;
		font-size: 0.75rem;
	}

	.stat-values {
		margin-left: auto;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e8ecf1;
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.stat-input {
		width: 4rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid transparent;
		border-radius: 0.25rem;
		color: inherit;
		font-size: inherit;
		font-weight: inherit;
		text-align: right;
		padding: 0.1rem 0.25rem;
		-moz-appearance: textfield;
	}

	.stat-input:focus {
		outline: none;
		border-color: #3a4d66;
		background: rgba(255, 255, 255, 0.1);
	}

	.stat-input::-webkit-outer-spin-button,
	.stat-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
	}

	.stat-input-max {
		width: 4rem;
		color: #c5d0dc;
	}

	.stat-hp .stat-bar-top i { color: #e74c3c; }
	.stat-ap .stat-bar-top i { color: #3498db; }
	.stat-xp .stat-bar-top i { color: #9b59b6; }

	.bar-track {
		height: 0.5rem;
		background: #243044;
		border-radius: 9999px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 0.2s;
	}

	.stat-hp .bar-fill { background: #e74c3c; }
	.stat-ap .bar-fill { background: #3498db; }
	.stat-xp .bar-fill { background: #9b59b6; }

	.stat-move {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.85rem;
		background: #243044;
		border-radius: 0.5rem;
		font-size: 0.8rem;
		flex-shrink: 0;
	}

	.stat-move i { color: #f1c40f; }

	.stat-input-move {
		width: 2.75rem;
		font-weight: 700;
		font-size: 0.95rem;
		color: #fff;
		background: transparent;
		border: none;
		text-align: center;
		padding: 0;
	}

	.sheet-body {
		display: grid;
		grid-template-columns: minmax(14rem, 17rem) minmax(0, 1fr);
		min-height: 32rem;
	}

	.sheet-scroll {
		scrollbar-width: thin;
		scrollbar-color: #3a4d66 #1a2332;
	}

	.sheet-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.sheet-scroll::-webkit-scrollbar-track {
		background: #141b26;
		border-radius: 4px;
	}

	.sheet-scroll::-webkit-scrollbar-thumb {
		background: #3a4d66;
		border-radius: 4px;
		border: 2px solid #141b26;
	}

	.sheet-scroll::-webkit-scrollbar-thumb:hover {
		background: #4a6078;
	}

	.sheet-sidebar {
		background: #1a2332;
		border-right: 1px solid #2d3a4d;
		padding: 1rem;
		overflow-y: auto;
		max-height: calc(100vh - 10rem);
	}

	.sidebar-title {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #8899aa;
		margin-bottom: 1rem;
	}

	.attr-block {
		margin-bottom: 1rem;
	}

	.attr-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.5rem;
		background: var(--accent-bg);
		border-left: 3px solid var(--accent);
		border-radius: 0 0.25rem 0.25rem 0;
		margin-bottom: 0.35rem;
	}

	.attr-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent);
	}

	.attr-stepper {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.attr-value {
		min-width: 1.25rem;
		text-align: center;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 0.25rem;
		padding: 0.1rem 0.35rem;
		background: rgba(0, 0, 0, 0.2);
	}

	.skill-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.skill-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.35rem;
		font-size: 0.72rem;
	}

	.skill-line-sub {
		padding-left: 1rem;
		opacity: 0.9;
	}

	.skill-dot {
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 9999px;
		background: var(--accent);
		flex-shrink: 0;
	}

	.skill-name {
		flex: 1;
		color: #c5d0dc;
	}

	.skill-rank {
		min-width: 1rem;
		text-align: center;
		font-weight: 600;
		color: #fff;
	}

	.skill-stepper {
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.mini-btn {
		width: 1.1rem;
		height: 1.1rem;
		border: 1px solid #3a4d66;
		background: #243044;
		color: #c5d0dc;
		border-radius: 0.2rem;
		font-size: 0.7rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	.mini-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.notes-panel .notes-input {
		width: 100%;
		min-height: 6rem;
		background: #1e2736;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		padding: 0.75rem;
		color: #c5d0dc;
		font-size: 0.85rem;
		line-height: 1.5;
		resize: vertical;
	}

	.sheet-main {
		width: 100%;
		padding: 1.25rem 1.5rem;
		overflow-y: auto;
		max-height: calc(100vh - 10rem);
		min-width: 0;
		box-sizing: border-box;
	}

	.main-sections {
		width: 100%;
	}

	.desktop-sections {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
	}

	.mobile-sections {
		display: none;
		width: 100%;
	}

	.mobile-attributes {
		width: 100%;
	}

	.sheet-tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid #2d3a4d;
		margin-bottom: 1.25rem;
	}

	.sheet-tab {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.65rem 1rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: #8899aa;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		cursor: pointer;
		margin-bottom: -1px;
	}

	.sheet-tab-active {
		color: #c9a227;
		border-bottom-color: #c9a227;
	}

	.panel {
		margin-bottom: 1.75rem;
		width: 100%;
	}

	.panel-header h3 {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #a8b8c8;
		text-transform: uppercase;
	}

	.panel-meta {
		font-size: 0.7rem;
		color: #8899aa;
		letter-spacing: 0.05em;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.85rem;
		width: 100%;
	}

	.item-card-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		width: 100%;
	}

	.item-card,
	.ability-card,
	.empty-slot {
		background: #1a2332;
		border: 1px solid var(--item-accent, #2d3a4d);
		border-radius: 0.5rem;
		position: relative;
		overflow: hidden;
	}

	.item-card {
		display: flex;
		flex: 1 1 calc(50% - 0.5rem);
		min-width: min(100%, 22rem);
		max-width: calc(50% - 0.5rem);
		min-height: 9.5rem;
		padding: 0;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--item-accent, #2d3a4d) 35%, transparent);
	}

	.item-card-media {
		position: relative;
		flex: 0 0 42%;
		max-width: 10rem;
		min-width: 6.5rem;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--item-accent) 28%, #141b26) 0%,
			#141b26 70%
		);
		border-right: 1px solid color-mix(in srgb, var(--item-accent) 40%, #2d3a4d);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.item-qty-badge {
		position: absolute;
		top: 0.4rem;
		left: 0.4rem;
		z-index: 2;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		border-radius: 0.2rem;
		background: var(--item-accent);
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.item-card-image {
		width: 100%;
		height: 100%;
		min-height: 7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
	}

	.item-placeholder {
		font-size: 2rem;
		color: color-mix(in srgb, var(--item-accent) 55%, #5a6a7a);
		opacity: 0.85;
	}

	.item-thumb {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
	}

	.item-overlay-stat {
		position: absolute;
		left: 0.35rem;
		bottom: 0.35rem;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.62rem;
		font-weight: 700;
		color: #e8ecf1;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}

	.item-overlay-stat i {
		color: var(--item-accent);
		font-size: 0.6rem;
	}

	.item-card-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 0.65rem 0.75rem 0.55rem;
		gap: 0.35rem;
	}

	.item-card-head {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.item-card-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.item-card-title-row h4 {
		flex: 1;
		min-width: 0;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.2;
		color: #f0f4f8;
	}

	.item-type-badge {
		flex-shrink: 0;
		padding: 0.12rem 0.4rem;
		border-radius: 0.2rem;
		background: var(--item-accent);
		color: #fff;
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.3;
	}

	.item-desc {
		font-size: 0.68rem;
		color: #8899aa;
		line-height: 1.35;
		margin-bottom: 0.35rem;
	}

	.item-stat-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
	}

	.item-stat-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.62rem;
	}

	.item-stat-row i {
		color: var(--item-accent);
		font-size: 0.65rem;
		width: 0.85rem;
		text-align: center;
	}

	.stat-key {
		color: #8899aa;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.stat-val {
		color: #e8ecf1;
		font-weight: 700;
		text-align: right;
	}

	.item-card-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: auto;
		padding-top: 0.25rem;
	}

	.item-action-primary {
		flex: 0 1 auto;
		max-width: 6.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.4rem 0.55rem;
		border: none;
		border-radius: 0.3rem;
		background: var(--item-accent);
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.item-action-primary:hover {
		filter: brightness(1.08);
	}

	.item-action-edit {
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		max-width: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid #3a4d66;
		border-radius: 0.3rem;
		color: #8899aa;
		font-size: 0.65rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	.item-action-edit:hover {
		color: #c5d0dc;
		border-color: #5dade2;
	}

	.ability-card,
	.empty-slot {
		padding: 0.75rem;
		border-color: #2d3a4d;
	}

	.empty-slot.item-card {
		flex: 1 1 calc(50% - 0.5rem);
		min-width: min(100%, 22rem);
		max-width: calc(50% - 0.5rem);
		min-height: 9.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border-style: dashed;
		border-color: #3a4d66;
		background: transparent;
		color: #8899aa;
		cursor: pointer;
		font-size: 0.65rem;
		box-shadow: none;
	}

	.ability-card {
		display: flex;
		flex-direction: column;
		min-height: 8.5rem;
	}

	.ability-card-lg {
		min-height: 9rem;
	}

	.ability-icon {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		background: rgba(93, 173, 226, 0.15);
		color: #5dade2;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		margin-bottom: 0.5rem;
		overflow: hidden;
		flex-shrink: 0;
	}

	.ability-icon-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.ability-top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.ability-top h4 {
		font-size: 0.72rem;
		font-weight: 600;
	}

	.ability-desc {
		font-size: 0.62rem;
		color: #8899aa;
		line-height: 1.35;
		flex: 1;
	}

	.ability-details {
		margin: 0.35rem 0 0;
		padding-left: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.ability-details li {
		font-size: 0.58rem;
		color: #6a7a8d;
		line-height: 1.35;
	}

	.ability-source {
		font-size: 0.55rem;
		color: #5a6a7a;
		margin-top: 0.35rem;
	}

	.card-menu {
		position: absolute;
		bottom: 0.4rem;
		right: 0.4rem;
		background: none;
		border: none;
		color: #8899aa;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.15rem 0.25rem;
	}

	.empty-slot:not(.item-card) {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border-style: dashed;
		border-color: #3a4d66;
		background: transparent;
		color: #8899aa;
		cursor: pointer;
		font-size: 0.65rem;
		min-height: 8.5rem;
	}

	.empty-slot-sm {
		min-height: 8.5rem;
	}

	.empty-plus {
		font-size: 1.5rem;
		color: #5a6a7a;
		line-height: 1;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.85rem;
	}

	@media (max-width: 768px) {
		.sheet-header {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.header-left {
			width: 100%;
		}

		.header-stats {
			width: 100%;
			flex-direction: column;
			align-items: stretch;
			gap: 0.65rem;
		}

		.stat-bar {
			width: 100%;
			min-width: 0;
		}

		.stat-move {
			align-self: flex-start;
		}

		.sheet-body {
			grid-template-columns: 1fr;
		}

		.desktop-sidebar {
			display: none;
		}

		.desktop-sections {
			display: none;
		}

		.mobile-sections {
			display: block;
		}

		.sheet-tabs {
			overflow-x: auto;
			flex-wrap: nowrap;
		}

		.sheet-tab {
			flex-shrink: 0;
			padding: 0.55rem 0.75rem;
			font-size: 0.68rem;
		}

		.card-grid {
			grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		}

		.item-card,
		.empty-slot.item-card {
			flex: 1 1 100%;
			max-width: 100%;
		}
	}
</style>
