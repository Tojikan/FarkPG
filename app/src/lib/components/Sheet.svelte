<script lang="ts">
	import { onMount } from 'svelte';
	import { createClient } from '$lib/supabase/client';
	import { characterChannel, announceSave } from '$lib/realtime';
	import { characterImageUrl } from '$lib/images';
	import { syncDerived, normalizeData, uid } from '$lib/character';
	import type { CharacterData, InventoryItem } from '$lib/character';
	import { skillsByAttribute } from '$lib/settings';
	import type { SettingDefinition } from '$lib/settings/types';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	interface CampaignItem {
		id: string;
		name: string;
		description: string;
		data: Record<string, string | number>;
	}

	interface SheetState {
		name: string;
		player_name: string;
		image_path: string | null;
		data: CharacterData;
	}

	let {
		setting,
		characterId,
		initial,
		items = [],
		mode,
		save,
		refetch
	}: {
		setting: SettingDefinition;
		characterId: string;
		initial: SheetState;
		items?: CampaignItem[];
		mode: 'gm' | 'player';
		save: (state: SheetState) => Promise<boolean>;
		refetch: () => Promise<SheetState | null>;
	} = $props();

	const supabase = createClient();
	const clientId = uid();

	// Props are intentionally captured once; realtime refetch updates them explicitly.
	// svelte-ignore state_referenced_locally
	let name = $state(initial.name);
	// svelte-ignore state_referenced_locally
	let playerName = $state(initial.player_name);
	// svelte-ignore state_referenced_locally
	let imagePath = $state(initial.image_path);
	// svelte-ignore state_referenced_locally
	let data = $state<CharacterData>(normalizeData(setting, initial.data));

	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let channel: RealtimeChannel | null = null;

	// --- Autosave -------------------------------------------------------------
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSave() {
		saveStatus = 'saving';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(flushSave, 600);
	}

	async function flushSave() {
		saveTimer = null;
		data = syncDerived(setting, data);
		const ok = await save({
			name,
			player_name: playerName,
			image_path: imagePath,
			data: $state.snapshot(data) as CharacterData
		});
		saveStatus = ok ? 'saved' : 'error';
		if (ok && channel) announceSave(channel, clientId);
	}

	onMount(() => {
		channel = characterChannel(supabase, characterId, clientId, async () => {
			// Don't clobber local unsaved edits with the remote state.
			if (saveTimer) return;
			const fresh = await refetch();
			if (!fresh) return;
			name = fresh.name;
			playerName = fresh.player_name;
			imagePath = fresh.image_path;
			data = normalizeData(setting, fresh.data);
		});
		return () => {
			channel?.unsubscribe();
		};
	});

	// --- Edit-in-place ----------------------------------------------------------
	let editKey = $state<string | null>(null);
	let editValue = $state('');

	function beginEdit(key: string, current: string | number) {
		editKey = key;
		editValue = String(current);
	}

	function commitEdit() {
		if (editKey == null) return;
		const [kind, id] = editKey.split(':', 2);
		const num = Number(editValue);

		if (kind === 'name' && editValue.trim()) name = editValue.trim();
		if (kind === 'player') playerName = editValue.trim();
		if (kind === 'attr' && Number.isFinite(num)) {
			data.attributes[id] = Math.max(0, Math.round(num));
			data = syncDerived(setting, data);
		}
		if (kind === 'res' && Number.isFinite(num)) {
			const res = data.resources[id];
			if (res) res.current = Math.max(0, Math.min(res.max, Math.round(num)));
		}
		if (kind === 'skill') {
			const skill = data.skills.find((s) => s.id === id);
			if (skill && Number.isFinite(num)) skill.rank = Math.max(0, Math.round(num));
		}
		if (kind === 'ability') {
			const ability = data.abilities.find((a) => a.id === id);
			if (ability && Number.isFinite(num)) ability.rank = Math.max(0, Math.round(num));
		}
		if (kind === 'qty') {
			const item = data.inventory.find((i) => i.uid === id);
			if (item && Number.isFinite(num)) item.qty = Math.max(1, Math.round(num));
		}
		editKey = null;
		scheduleSave();
	}

	function editKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
		if (e.key === 'Escape') editKey = null;
	}

	// --- Skills -------------------------------------------------------------
	let addingSkill = $state(false);
	let newSkillId = $state('');
	let customSkillName = $state('');
	let customSkillAttr = $state('');

	const ownedSkillIds = $derived(new Set(data.skills.map((s) => s.id)));
	const availableSkills = $derived(setting.skills.filter((s) => !ownedSkillIds.has(s.id)));

	function addCatalogSkill() {
		const def = setting.skills.find((s) => s.id === newSkillId);
		if (!def) return;
		data.skills.push({ ...def, rank: 1, custom: false });
		newSkillId = '';
		scheduleSave();
	}

	function addCustomSkill() {
		if (!customSkillName.trim() || !customSkillAttr) return;
		data.skills.push({
			id: `custom-${uid()}`,
			name: customSkillName.trim(),
			attribute: customSkillAttr,
			rank: 1,
			custom: true
		});
		customSkillName = '';
		scheduleSave();
	}

	function removeSkill(id: string) {
		data.skills = data.skills.filter((s) => s.id !== id);
		scheduleSave();
	}

	// --- Abilities ------------------------------------------------------------
	const canAddAbilities = $derived(mode === 'gm' || setting.flags.playersCanAddAbilities);
	const canAddCustomAbilities = $derived(canAddAbilities && setting.flags.allowCustomAbilities);
	let newAbilityId = $state('');
	let customAbilityName = $state('');

	const ownedAbilityIds = $derived(new Set(data.abilities.map((a) => a.id)));
	const availableAbilities = $derived(setting.abilities.filter((a) => !ownedAbilityIds.has(a.id)));

	function addCatalogAbility() {
		const def = setting.abilities.find((a) => a.id === newAbilityId);
		if (!def) return;
		data.abilities.push({ ...def, rank: 1 });
		newAbilityId = '';
		scheduleSave();
	}

	function addCustomAbility() {
		if (!customAbilityName.trim()) return;
		data.abilities.push({ id: `custom-${uid()}`, name: customAbilityName.trim(), rank: 1, custom: true });
		customAbilityName = '';
		scheduleSave();
	}

	function removeAbility(id: string) {
		data.abilities = data.abilities.filter((a) => a.id !== id);
		scheduleSave();
	}

	// --- Inventory ---------------------------------------------------------------
	let itemSearch = $state('');
	let customItemName = $state('');
	let customItemDesc = $state('');

	const searchResults = $derived(
		itemSearch.trim()
			? items.filter((i) => i.name.toLowerCase().includes(itemSearch.trim().toLowerCase())).slice(0, 8)
			: []
	);

	/** Items are copied (snapshotted) into inventory so players can tweak them. */
	function addItem(item: CampaignItem) {
		data.inventory.push({
			uid: uid(),
			name: item.name,
			description: item.description,
			qty: 1,
			equipped: false,
			data: { ...item.data }
		});
		itemSearch = '';
		scheduleSave();
	}

	function addCustomItem() {
		if (!customItemName.trim()) return;
		data.inventory.push({
			uid: uid(),
			name: customItemName.trim(),
			description: customItemDesc.trim(),
			qty: 1,
			equipped: false,
			data: {}
		});
		customItemName = '';
		customItemDesc = '';
		scheduleSave();
	}

	function toggleEquipped(item: InventoryItem) {
		item.equipped = !item.equipped;
		scheduleSave();
	}

	function removeItem(itemUid: string) {
		data.inventory = data.inventory.filter((i) => i.uid !== itemUid);
		scheduleSave();
	}

	const equipped = $derived(data.inventory.filter((i) => i.equipped));
	const backpack = $derived(data.inventory.filter((i) => !i.equipped));

	// --- GM drag-and-drop -----------------------------------------------------
	let dragOver = $state(false);

	function onItemDragStart(e: DragEvent, item: CampaignItem) {
		e.dataTransfer?.setData('application/x-item-id', item.id);
	}

	function onInventoryDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const id = e.dataTransfer?.getData('application/x-item-id');
		const item = items.find((i) => i.id === id);
		if (item) addItem(item);
	}

	// --- Portrait ---------------------------------------------------------------
	async function replaceImage(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
		const path = `${uid()}.${ext}`;
		const { error } = await supabase.storage.from('character-images').upload(path, file);
		if (!error) {
			imagePath = path;
			scheduleSave();
		}
	}

	const background = $derived(setting.backgrounds?.find((b) => b.id === data.background));
</script>

<div data-setting={setting.id} class="pb-16">
	<!-- Header -->
	<div class="flex flex-wrap items-center gap-4">
		<label class="group relative cursor-pointer" title="Change portrait">
			{#if characterImageUrl(imagePath)}
				<img
					src={characterImageUrl(imagePath)}
					alt={name}
					class="h-20 w-20 rounded-lg border border-edge object-cover"
				/>
			{:else}
				<div
					class="flex h-20 w-20 items-center justify-center rounded-lg border border-edge bg-raised
						font-display text-3xl text-muted"
				>
					{name.charAt(0).toUpperCase() || '?'}
				</div>
			{/if}
			<span
				class="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/60 text-xs
					text-white group-hover:flex"
			>
				change
			</span>
			<input type="file" accept="image/*" class="hidden" onchange={replaceImage} />
		</label>

		<div class="min-w-0 flex-1">
			{#if editKey === 'name'}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="field font-display text-2xl font-bold"
					bind:value={editValue}
					onblur={commitEdit}
					onkeydown={editKeydown}
					autofocus
				/>
			{:else}
				<button
					class="cursor-pointer text-left font-display text-2xl font-bold hover:text-accent"
					onclick={() => beginEdit('name', name)}
					title="Click to edit"
				>
					{name}
				</button>
			{/if}
			<p class="text-sm text-muted">
				{#if editKey === 'player'}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="field inline-block w-44 px-2 py-0.5 text-sm"
						bind:value={editValue}
						onblur={commitEdit}
						onkeydown={editKeydown}
						autofocus
					/>
				{:else}
					<button class="cursor-pointer hover:text-accent" onclick={() => beginEdit('player', playerName)}>
						{playerName ? `played by ${playerName}` : 'set player name'}
					</button>
				{/if}
				{#if background}
					· <span class="text-accent">{background.name}</span>
				{/if}
			</p>
		</div>

		<span
			class="text-xs
				{saveStatus === 'error' ? 'text-danger' : saveStatus === 'saving' ? 'text-muted' : 'text-muted/60'}"
		>
			{#if saveStatus === 'saving'}Saving…{/if}
			{#if saveStatus === 'saved'}Saved{/if}
			{#if saveStatus === 'error'}Save failed — retrying on next edit{/if}
		</span>
	</div>

	<div class="mt-6 grid gap-6 {mode === 'gm' ? 'lg:grid-cols-[1fr_280px]' : ''}">
		<div class="min-w-0 space-y-6">
			<!-- Attributes + skills -->
			<section class="card">
				<h2 class="font-display text-lg font-bold">Attributes & skills</h2>
				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					{#each skillsByAttribute(setting) as group (group.attribute.id)}
						{@const customInGroup = data.skills.filter(
							(s) => s.custom && s.attribute === group.attribute.id
						)}
						<div class="rounded-md bg-raised p-3">
							<div class="flex items-center justify-between">
								<span class="font-display font-bold text-accent">{group.attribute.name}</span>
								{#if editKey === `attr:${group.attribute.id}`}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="field w-16 px-2 py-0.5 text-center font-mono"
										type="number"
										bind:value={editValue}
										onblur={commitEdit}
										onkeydown={editKeydown}
										autofocus
									/>
								{:else}
									<button
										class="cursor-pointer rounded px-2 font-mono text-xl font-bold hover:bg-surface"
										onclick={() => beginEdit(`attr:${group.attribute.id}`, data.attributes[group.attribute.id] ?? 0)}
										title="Click to edit"
									>
										{data.attributes[group.attribute.id] ?? 0}
									</button>
								{/if}
							</div>
							<ul class="mt-2 space-y-1 text-sm">
								{#each [...group.skills.filter((s) => ownedSkillIds.has(s.id)).map((s) => data.skills.find((d) => d.id === s.id)!), ...customInGroup] as skill (skill.id)}
									<li class="group flex items-center justify-between gap-2">
										<span title={skill.description}>{skill.name}{skill.custom ? ' *' : ''}</span>
										<span class="flex items-center gap-1">
											{#if editKey === `skill:${skill.id}`}
												<!-- svelte-ignore a11y_autofocus -->
												<input
													class="field w-12 px-1 py-0 text-center font-mono text-sm"
													type="number"
													bind:value={editValue}
													onblur={commitEdit}
													onkeydown={editKeydown}
													autofocus
												/>
											{:else}
												<button
													class="cursor-pointer rounded px-1.5 font-mono hover:bg-surface"
													onclick={() => beginEdit(`skill:${skill.id}`, skill.rank)}
												>
													{skill.rank}
												</button>
											{/if}
											<button
												class="hidden text-xs text-muted hover:text-danger group-hover:inline"
												onclick={() => removeSkill(skill.id)}
												title="Remove skill"
											>
												×
											</button>
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>

				<div class="mt-3 border-t border-edge pt-3">
					{#if addingSkill}
						<div class="flex flex-wrap items-center gap-2">
							<select class="field w-56" bind:value={newSkillId}>
								<option value="" disabled selected>From catalog…</option>
								{#each availableSkills as skill (skill.id)}
									<option value={skill.id}>{skill.name}</option>
								{/each}
							</select>
							<button class="btn-ghost px-3 py-1 text-sm" onclick={addCatalogSkill} disabled={!newSkillId}>
								Add
							</button>
							{#if setting.flags.allowCustomSkills}
								<span class="text-xs text-muted">or custom:</span>
								<input class="field w-40" bind:value={customSkillName} placeholder="Skill name" />
								<select class="field w-36" bind:value={customSkillAttr}>
									<option value="" disabled selected>Attribute…</option>
									{#each setting.attributes as attr (attr.id)}
										<option value={attr.id}>{attr.name}</option>
									{/each}
								</select>
								<button class="btn-ghost px-3 py-1 text-sm" onclick={addCustomSkill}>Add custom</button>
							{/if}
							<button class="ml-auto text-xs text-muted hover:text-ink" onclick={() => (addingSkill = false)}>
								done
							</button>
						</div>
					{:else}
						<button class="text-sm text-accent hover:underline" onclick={() => (addingSkill = true)}>
							+ Add skill
						</button>
					{/if}
				</div>
			</section>

			<!-- Resources -->
			<section class="card">
				<h2 class="font-display text-lg font-bold">Resources</h2>
				<div class="mt-3 flex flex-wrap gap-4">
					{#each setting.resources as res (res.id)}
						{@const r = data.resources[res.id]}
						<div class="min-w-40 flex-1 rounded-md bg-raised p-3">
							<p class="text-xs tracking-wide text-muted uppercase">{res.name}</p>
							<p class="mt-1 font-mono text-xl">
								{#if editKey === `res:${res.id}`}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="field inline-block w-28 px-2 py-0.5 text-center font-mono"
										type="number"
										bind:value={editValue}
										onblur={commitEdit}
										onkeydown={editKeydown}
										autofocus
									/>
								{:else}
									<button
										class="cursor-pointer rounded px-1 hover:bg-surface"
										onclick={() => beginEdit(`res:${res.id}`, r?.current ?? 0)}
										title="Click to edit current value"
									>
										{(r?.current ?? 0).toLocaleString()}
									</button>
								{/if}
								<span class="text-muted">/ {(r?.max ?? 0).toLocaleString()}</span>
							</p>
							<div class="mt-2 h-1.5 overflow-hidden rounded bg-surface">
								<div
									class="h-full bg-accent"
									style="width: {r?.max ? Math.round(((r?.current ?? 0) / r.max) * 100) : 0}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- Inventory -->
			<section
				class="card {dragOver ? 'border-accent' : ''}"
				role="group"
				aria-label="Inventory (drop target for campaign items)"
				ondragover={(e) => {
					if (mode === 'gm') {
						e.preventDefault();
						dragOver = true;
					}
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={onInventoryDrop}
			>
				<h2 class="font-display text-lg font-bold">Equipped & inventory</h2>

				{#snippet itemRow(item: InventoryItem)}
					<li class="group flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-1.5 text-sm">
						<button
							class="cursor-pointer text-xs {item.equipped ? 'text-accent' : 'text-muted hover:text-ink'}"
							onclick={() => toggleEquipped(item)}
							title={item.equipped ? 'Unequip' : 'Equip'}
						>
							{item.equipped ? '◆' : '◇'}
						</button>
						<span class="font-semibold">{item.name}</span>
						{#if item.description}<span class="text-xs text-muted">{item.description}</span>{/if}
						{#each Object.entries(item.data) as [key, value] (key)}
							<span class="rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
								{setting.itemFields.find((f) => f.id === key)?.name ?? key}: {value}
							</span>
						{/each}
						<span class="ml-auto flex items-center gap-2">
							{#if editKey === `qty:${item.uid}`}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									class="field w-14 px-1 py-0 text-center font-mono text-sm"
									type="number"
									bind:value={editValue}
									onblur={commitEdit}
									onkeydown={editKeydown}
									autofocus
								/>
							{:else}
								<button
									class="cursor-pointer rounded px-1 font-mono text-xs text-muted hover:bg-surface"
									onclick={() => beginEdit(`qty:${item.uid}`, item.qty)}
									title="Quantity — click to edit"
								>
									×{item.qty}
								</button>
							{/if}
							<button
								class="hidden text-xs text-muted hover:text-danger group-hover:inline"
								onclick={() => removeItem(item.uid)}
								title="Remove item"
							>
								×
							</button>
						</span>
					</li>
				{/snippet}

				{#if equipped.length > 0}
					<p class="mt-3 text-xs tracking-wide text-muted uppercase">Equipped</p>
					<ul class="mt-1 space-y-1">
						{#each equipped as item (item.uid)}{@render itemRow(item)}{/each}
					</ul>
				{/if}
				<p class="mt-3 text-xs tracking-wide text-muted uppercase">Backpack</p>
				{#if backpack.length === 0}
					<p class="mt-1 text-sm text-muted">Empty{mode === 'gm' ? ' — drag items from the panel' : ''}</p>
				{:else}
					<ul class="mt-1 space-y-1">
						{#each backpack as item (item.uid)}{@render itemRow(item)}{/each}
					</ul>
				{/if}

				<!-- Quick add -->
				<div class="mt-4 border-t border-edge pt-3">
					<div class="relative">
						<input
							class="field"
							bind:value={itemSearch}
							placeholder="Quick add from campaign items…"
						/>
						{#if searchResults.length > 0}
							<ul
								class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-edge-strong
									bg-surface shadow-lg"
							>
								{#each searchResults as item (item.id)}
									<li>
										<button
											class="flex w-full cursor-pointer items-baseline gap-2 px-3 py-2 text-left text-sm
												hover:bg-raised"
											onclick={() => addItem(item)}
										>
											<span class="font-semibold">{item.name}</span>
											{#if item.description}<span class="truncate text-xs text-muted">{item.description}</span>{/if}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
					<div class="mt-2 flex flex-wrap gap-2">
						<input class="field flex-1" bind:value={customItemName} placeholder="Or a custom item name" />
						<input class="field flex-2" bind:value={customItemDesc} placeholder="Description (optional)" />
						<button class="btn-ghost" onclick={addCustomItem} disabled={!customItemName.trim()}>Add</button>
					</div>
				</div>
			</section>

			<!-- Abilities -->
			<section class="card">
				<h2 class="font-display text-lg font-bold">{setting.abilitiesLabel ?? 'Abilities'}</h2>
				{#if data.abilities.length === 0}
					<p class="mt-2 text-sm text-muted">None</p>
				{:else}
					<ul class="mt-3 space-y-1">
						{#each data.abilities as ability (ability.id)}
							<li class="group flex items-center gap-2 rounded-md bg-raised px-3 py-1.5 text-sm">
								<span class="font-semibold" title={ability.description}>
									{ability.name}{ability.custom ? ' *' : ''}
								</span>
								{#if ability.description}
									<span class="hidden truncate text-xs text-muted sm:inline">{ability.description}</span>
								{/if}
								<span class="ml-auto flex items-center gap-2">
									{#if editKey === `ability:${ability.id}`}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											class="field w-12 px-1 py-0 text-center font-mono text-sm"
											type="number"
											bind:value={editValue}
											onblur={commitEdit}
											onkeydown={editKeydown}
											autofocus
										/>
									{:else}
										<button
											class="cursor-pointer rounded px-1.5 font-mono hover:bg-surface"
											onclick={() => beginEdit(`ability:${ability.id}`, ability.rank)}
										>
											{ability.rank}
										</button>
									{/if}
									{#if canAddAbilities}
										<button
											class="hidden text-xs text-muted hover:text-danger group-hover:inline"
											onclick={() => removeAbility(ability.id)}
											title="Remove"
										>
											×
										</button>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if canAddAbilities}
					<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-edge pt-3">
						<select class="field w-56" bind:value={newAbilityId}>
							<option value="" disabled selected>From catalog…</option>
							{#each availableAbilities as ability (ability.id)}
								<option value={ability.id}>{ability.name}</option>
							{/each}
						</select>
						<button class="btn-ghost px-3 py-1 text-sm" onclick={addCatalogAbility} disabled={!newAbilityId}>
							Add
						</button>
						{#if canAddCustomAbilities}
							<input class="field w-48" bind:value={customAbilityName} placeholder="Custom name" />
							<button class="btn-ghost px-3 py-1 text-sm" onclick={addCustomAbility}>Add custom</button>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Notes -->
			<section class="card">
				<h2 class="font-display text-lg font-bold">Notes</h2>
				<textarea
					class="field mt-3 min-h-32"
					bind:value={data.notes}
					oninput={scheduleSave}
					placeholder="Anything worth remembering…"
				></textarea>
			</section>
		</div>

		{#if mode === 'gm'}
			<!-- GM item panel: drag onto the inventory section -->
			<aside class="card h-fit lg:sticky lg:top-4">
				<h2 class="font-display text-sm font-bold tracking-wide uppercase">Campaign items</h2>
				<p class="mt-1 text-xs text-muted">Drag onto the inventory, or click to add.</p>
				<ul class="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
					{#each items as item (item.id)}
						<li>
							<button
								class="w-full cursor-grab rounded-md border border-edge-strong px-3 py-1.5 text-left
									text-sm hover:border-accent active:cursor-grabbing"
								draggable="true"
								ondragstart={(e) => onItemDragStart(e, item)}
								onclick={() => addItem(item)}
							>
								<span class="font-semibold">{item.name}</span>
								{#if item.description}<span class="block truncate text-xs text-muted">{item.description}</span>{/if}
							</button>
						</li>
					{:else}
						<li class="text-sm text-muted">No items yet.</li>
					{/each}
				</ul>
			</aside>
		{/if}
	</div>
</div>
