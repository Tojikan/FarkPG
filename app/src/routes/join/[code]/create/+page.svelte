<script lang="ts">
	import { page } from '$app/state';
	import { createClient } from '$lib/supabase/client';
	import { getSetting, skillsByAttribute } from '$lib/settings';
	import { attributePointsSpent, nextStepCost, rankTotalCost } from '$lib/settings/costs';
	import { syncDerived, uid, type CharacterData } from '$lib/character';
	import { rememberCodes } from '$lib/playerCodes';
	import type { SettingDefinition } from '$lib/settings/types';

	const supabase = createClient();
	const campaignCode = page.params.code!.toUpperCase();

	// --- Campaign / setting bootstrap -------------------------------------
	let setting = $state<SettingDefinition | null>(null);
	let campaignName = $state('');
	let bootError = $state('');

	$effect(() => {
		supabase
			.rpc('join_campaign', { p_campaign_code: campaignCode })
			.then(({ data, error }) => {
				if (error || !data) {
					bootError = 'No campaign found with that code.';
					return;
				}
				if (!data.slots_available) {
					bootError = 'This campaign is full.';
					return;
				}
				campaignName = data.name;
				try {
					const s = getSetting(data.setting_id);
					setting = s;
					attributes = Object.fromEntries(
						s.attributes.map((a) => [a.id, s.creation.attributes.start])
					);
				} catch {
					bootError = 'This campaign uses a setting this app does not know.';
				}
			});
	});

	// --- Wizard state -------------------------------------------------------
	let stepIndex = $state(0);
	let name = $state('');
	let playerName = $state('');
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let backgroundId = $state<string | null>(null);
	let attributes = $state<Record<string, number>>({});
	let skillRanks = $state<Record<string, number>>({});
	let customSkills = $state<{ id: string; name: string; attribute: string }[]>([]);
	let abilityRanks = $state<Record<string, number>>({});
	let pickedAbilities = $state<Record<string, boolean>>({});
	let customAbilities = $state<{ id: string; name: string }[]>([]);
	let newSkillName = $state('');
	let newSkillAttr = $state('');
	let newAbilityName = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let result = $state<{ character_code: string } | null>(null);

	const steps = $derived.by(() => {
		if (!setting) return [];
		const list = ['Name'];
		if (setting.backgrounds?.length) list.push('Background');
		list.push('Attributes', 'Skills', setting.abilitiesLabel ?? 'Abilities', 'Review');
		return list;
	});
	const stepName = $derived(steps[stepIndex] ?? '');

	// --- Pools (background bonuses applied) ----------------------------------
	const background = $derived(setting?.backgrounds?.find((b) => b.id === backgroundId) ?? null);
	function poolBonus(pool: 'attributes' | 'skills' | 'abilities') {
		return background?.bonus.pool === pool ? background.bonus.amount : 0;
	}

	const attrRules = $derived(setting?.creation.attributes);
	const attrPool = $derived((attrRules?.pool ?? 0) + poolBonus('attributes'));
	const attrSpent = $derived(attrRules ? attributePointsSpent(attrRules, attributes) : 0);
	const attrRemaining = $derived(attrPool - attrSpent);

	const skillRules = $derived(setting?.creation.skills);
	const skillPool = $derived((skillRules?.pool ?? 0) + poolBonus('skills'));
	const skillSpent = $derived(
		Object.values(skillRanks).reduce(
			(sum, rank) => sum + rankTotalCost(skillRules?.rankCosts ?? [], rank),
			0
		)
	);
	const skillRemaining = $derived(skillPool - skillSpent);

	const abilityRules = $derived(setting?.creation.abilities);
	const abilityPool = $derived((abilityRules?.pool ?? 0) + poolBonus('abilities'));
	const abilitySpent = $derived(
		Object.values(abilityRanks).reduce(
			(sum, rank) => sum + rankTotalCost(abilityRules?.rankCosts ?? [], rank),
			0
		)
	);
	const abilityRemaining = $derived(abilityPool - abilitySpent);
	const pickedCount = $derived(Object.values(pickedAbilities).filter(Boolean).length);
	const pickLimit = $derived((abilityRules?.count ?? 0) + poolBonus('abilities'));

	// --- Step actions --------------------------------------------------------
	function bumpAttribute(id: string, delta: 1 | -1) {
		if (!attrRules) return;
		const next = attributes[id] + delta;
		if (next < attrRules.min || next > attrRules.max) return;
		if (delta === 1) {
			const cost =
				attributePointsSpent(attrRules, { ...attributes, [id]: next }) - attrSpent;
			if (cost > attrRemaining) return;
		}
		attributes[id] = next;
	}

	function bumpSkill(id: string, delta: 1 | -1) {
		if (!skillRules) return;
		const next = (skillRanks[id] ?? 0) + delta;
		if (next < 0 || next > skillRules.maxRank) return;
		const cost = rankTotalCost(skillRules.rankCosts, next) - rankTotalCost(skillRules.rankCosts, skillRanks[id] ?? 0);
		if (delta === 1 && cost > skillRemaining) return;
		skillRanks[id] = next;
	}

	function bumpAbility(id: string, delta: 1 | -1) {
		if (!abilityRules?.rankCosts || abilityRules.maxRank == null) return;
		const next = (abilityRanks[id] ?? 0) + delta;
		if (next < 0 || next > abilityRules.maxRank) return;
		const cost =
			rankTotalCost(abilityRules.rankCosts, next) -
			rankTotalCost(abilityRules.rankCosts, abilityRanks[id] ?? 0);
		if (delta === 1 && cost > abilityRemaining) return;
		abilityRanks[id] = next;
	}

	function togglePick(id: string) {
		const on = !pickedAbilities[id];
		if (on && pickedCount >= pickLimit) return;
		pickedAbilities[id] = on;
	}

	function addCustomSkill() {
		const trimmed = newSkillName.trim();
		if (!trimmed || !newSkillAttr) return;
		customSkills.push({ id: `custom-${uid()}`, name: trimmed, attribute: newSkillAttr });
		newSkillName = '';
	}

	function addCustomAbility() {
		const trimmed = newAbilityName.trim();
		if (!trimmed) return;
		customAbilities.push({ id: `custom-${uid()}`, name: trimmed });
		newAbilityName = '';
	}

	function onImagePicked(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0] ?? null;
		imageFile = file;
		imagePreview = file ? URL.createObjectURL(file) : null;
	}

	function canLeaveStep(): boolean {
		if (stepName === 'Name') return name.trim().length > 0;
		if (stepName === 'Background') return backgroundId != null;
		return true;
	}

	// --- Finish ---------------------------------------------------------------
	function buildData(): CharacterData {
		const s = setting!;
		const allSkills = [
			...s.skills.map((def) => ({ def, custom: false })),
			...customSkills.map((c) => ({
				def: { id: c.id, name: c.name, attribute: c.attribute, description: '' },
				custom: true
			}))
		];
		const skills = allSkills
			.filter(({ def }) => (skillRanks[def.id] ?? 0) > 0)
			.map(({ def, custom }) => ({
				id: def.id,
				name: def.name,
				attribute: def.attribute,
				rank: skillRanks[def.id] ?? 0,
				description: def.description,
				custom
			}));

		const abilities =
			abilityRules?.mode === 'point-buy'
				? s.abilities
						.filter((a) => (abilityRanks[a.id] ?? 0) > 0)
						.map((a) => ({ id: a.id, name: a.name, rank: abilityRanks[a.id], description: a.description }))
				: [
						...s.abilities
							.filter((a) => pickedAbilities[a.id])
							.map((a) => ({ id: a.id, name: a.name, rank: 1, description: a.description })),
						...customAbilities
							.filter((a) => pickedAbilities[a.id])
							.map((a) => ({ id: a.id, name: a.name, rank: 1, custom: true }))
					];

		return syncDerived(s, {
			background: backgroundId ?? undefined,
			attributes: { ...attributes },
			skills,
			resources: {},
			abilities,
			inventory: [],
			notes: ''
		});
	}

	async function finish() {
		submitting = true;
		submitError = '';

		let imagePath: string | null = null;
		if (imageFile) {
			const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
			const path = `${uid()}.${ext}`;
			const { error } = await supabase.storage
				.from('character-images')
				.upload(path, imageFile, { upsert: false });
			if (!error) imagePath = path;
		}

		const { data, error } = await supabase.rpc('create_character', {
			p_campaign_code: campaignCode,
			p_name: name.trim(),
			p_player_name: playerName.trim(),
			p_image_path: imagePath,
			p_data: buildData()
		});
		submitting = false;

		if (error || !data) {
			submitError = error?.message?.includes('full')
				? 'The campaign filled up while you were creating — sorry!'
				: 'Could not create the character. Try again.';
			return;
		}

		result = data as { character_code: string };
		rememberCodes({
			campaignCode,
			characterCode: result.character_code,
			name: name.trim()
		});
	}
</script>

<svelte:head><title>Create character · FarkPG</title></svelte:head>

{#if bootError}
	<div class="card mx-auto mt-16 max-w-md text-center">
		<p class="text-danger">{bootError}</p>
		<a href="/join" class="btn-ghost mt-4">Back to join</a>
	</div>
{:else if !setting}
	<p class="mt-16 text-center text-muted">Loading campaign…</p>
{:else if result}
	<div class="mx-auto mt-16 max-w-md" data-setting={setting.id}>
		<div class="card text-center">
			<h1 class="font-display text-2xl font-bold">{name} lives!</h1>
			<p class="mt-4 text-sm text-muted">Your character code — <strong class="text-ink">save this!</strong> It's how you get back to your sheet from any device:</p>
			<p class="mt-3 rounded-md bg-raised py-4 font-mono text-3xl font-bold tracking-[0.3em] text-accent">
				{result.character_code}
			</p>
			<a href="/sheet/{campaignCode}/{result.character_code}" class="btn-primary mt-6 w-full">
				Open your character sheet
			</a>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-2xl" data-setting={setting.id}>
		<p class="text-sm text-muted">{campaignName} · {setting.name}</p>
		<h1 class="font-display text-2xl font-bold">Create your character</h1>

		<!-- Step indicator -->
		<ol class="mt-4 flex flex-wrap gap-1 text-xs">
			{#each steps as label, i (label)}
				<li
					class="rounded-full px-3 py-1
						{i === stepIndex ? 'bg-accent font-semibold text-accent-ink' : i < stepIndex ? 'bg-raised text-ink' : 'bg-raised/50 text-muted'}"
				>
					{label}
				</li>
			{/each}
		</ol>

		<div class="card mt-4">
			{#if stepName === 'Name'}
				<div class="space-y-3">
					<label class="block">
						<span class="text-sm text-muted">Character name</span>
						<input class="field mt-1" bind:value={name} maxlength="60" placeholder="Name" />
					</label>
					<label class="block">
						<span class="text-sm text-muted">Your name (optional)</span>
						<input class="field mt-1" bind:value={playerName} maxlength="60" placeholder="Player" />
					</label>
					<label class="block">
						<span class="text-sm text-muted">Portrait (optional)</span>
						<input class="field mt-1" type="file" accept="image/*" onchange={onImagePicked} />
					</label>
					{#if imagePreview}
						<img src={imagePreview} alt="Portrait preview" class="h-28 w-28 rounded-md border border-edge object-cover" />
					{/if}
				</div>
			{:else if stepName === 'Background'}
				<div class="space-y-2">
					{#each setting.backgrounds ?? [] as bg (bg.id)}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-md border border-edge-strong p-3
								has-checked:border-accent has-checked:bg-raised"
						>
							<input type="radio" bind:group={backgroundId} value={bg.id} class="mt-1 accent-(--app-accent)" />
							<span>
								<span class="block font-semibold">{bg.name}</span>
								<span class="block text-sm text-muted">{bg.description}</span>
								<span class="mt-1 block text-xs text-accent">+{bg.bonus.amount} {bg.bonus.pool} points</span>
							</span>
						</label>
					{/each}
				</div>
			{:else if stepName === 'Attributes'}
				<div class="mb-3 flex items-baseline justify-between">
					<p class="text-sm text-muted">
						{#if attrRules?.mode === 'escalating'}
							Raising costs more the higher you go. Dropping any attribute below {attrRules.start}
							refunds {attrRules.belowStartRefund ?? 0} point — once, total.
						{:else}
							One point per step.
						{/if}
					</p>
					<p class="text-sm font-semibold {attrRemaining < 0 ? 'text-danger' : 'text-accent'}">
						{attrRemaining} left
					</p>
				</div>
				<ul class="space-y-2">
					{#each setting.attributes as attr (attr.id)}
						<li class="flex items-center gap-3 rounded-md bg-raised px-3 py-2">
							<div class="flex-1">
								<span class="font-semibold">{attr.name}</span>
								{#if attr.description}<span class="ml-2 hidden text-xs text-muted sm:inline">{attr.description}</span>{/if}
							</div>
							<button class="btn-ghost h-8 w-8 p-0" onclick={() => bumpAttribute(attr.id, -1)}>−</button>
							<span class="w-6 text-center font-mono text-lg">{attributes[attr.id]}</span>
							<button
								class="btn-ghost h-8 w-8 p-0"
								onclick={() => bumpAttribute(attr.id, 1)}
								title={attrRules ? `costs ${nextStepCost(attrRules, attributes[attr.id])}` : ''}
							>
								+
							</button>
						</li>
					{/each}
				</ul>
			{:else if stepName === 'Skills'}
				<div class="mb-3 flex items-baseline justify-between">
					<p class="text-sm text-muted">
						Rank {skillRules?.maxRank} max. Costs per rank: {skillRules?.rankCosts.join(', ')}.
					</p>
					<p class="text-sm font-semibold {skillRemaining < 0 ? 'text-danger' : 'text-accent'}">
						{skillRemaining} left
					</p>
				</div>
				{#each skillsByAttribute(setting) as group (group.attribute.id)}
					<h3 class="mt-4 font-display text-sm font-bold tracking-wide text-accent uppercase">
						{group.attribute.name}
					</h3>
					<ul class="mt-1 space-y-1">
						{#each [...group.skills, ...customSkills.filter((c) => c.attribute === group.attribute.id)] as skill (skill.id)}
							<li class="flex items-center gap-3 rounded-md bg-raised px-3 py-1.5">
								<div class="min-w-0 flex-1">
									<span class="text-sm font-semibold">{skill.name}</span>
									{#if 'description' in skill && skill.description}
										<span class="ml-2 hidden text-xs text-muted lg:inline">{skill.description}</span>
									{/if}
								</div>
								<button class="btn-ghost h-7 w-7 p-0 text-xs" onclick={() => bumpSkill(skill.id, -1)}>−</button>
								<span class="w-4 text-center font-mono">{skillRanks[skill.id] ?? 0}</span>
								<button class="btn-ghost h-7 w-7 p-0 text-xs" onclick={() => bumpSkill(skill.id, 1)}>+</button>
							</li>
						{/each}
					</ul>
				{/each}
				{#if setting.flags.allowCustomSkills}
					<div class="mt-5 flex flex-wrap gap-2 border-t border-edge pt-4">
						<input class="field flex-1" bind:value={newSkillName} placeholder="Custom skill name" />
						<select class="field w-40" bind:value={newSkillAttr}>
							<option value="" disabled selected>Attribute…</option>
							{#each setting.attributes as attr (attr.id)}
								<option value={attr.id}>{attr.name}</option>
							{/each}
						</select>
						<button class="btn-ghost" onclick={addCustomSkill}>Add skill</button>
					</div>
				{/if}
			{:else if stepName === (setting.abilitiesLabel ?? 'Abilities')}
				{#if abilityRules?.mode === 'point-buy'}
					<div class="mb-3 flex items-baseline justify-between">
						<p class="text-sm text-muted">
							Rank {abilityRules.maxRank} max. Costs per rank: {abilityRules.rankCosts?.join(', ')}.
						</p>
						<p class="text-sm font-semibold {abilityRemaining < 0 ? 'text-danger' : 'text-accent'}">
							{abilityRemaining} left
						</p>
					</div>
					<ul class="space-y-2">
						{#each setting.abilities as ability (ability.id)}
							<li class="flex items-center gap-3 rounded-md bg-raised px-3 py-2">
								<div class="min-w-0 flex-1">
									<span class="font-semibold">{ability.name}</span>
									{#if ability.description}<span class="ml-2 hidden text-xs text-muted sm:inline">{ability.description}</span>{/if}
								</div>
								<button class="btn-ghost h-8 w-8 p-0" onclick={() => bumpAbility(ability.id, -1)}>−</button>
								<span class="w-5 text-center font-mono">{abilityRanks[ability.id] ?? 0}</span>
								<button class="btn-ghost h-8 w-8 p-0" onclick={() => bumpAbility(ability.id, 1)}>+</button>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="mb-3 flex items-baseline justify-between">
						<p class="text-sm text-muted">Pick {pickLimit}.</p>
						<p class="text-sm font-semibold text-accent">{pickedCount}/{pickLimit} picked</p>
					</div>
					<ul class="space-y-2">
						{#each [...setting.abilities, ...customAbilities] as ability (ability.id)}
							<li>
								<label
									class="flex cursor-pointer items-start gap-3 rounded-md border border-edge-strong p-3
										has-checked:border-accent has-checked:bg-raised"
								>
									<input
										type="checkbox"
										checked={pickedAbilities[ability.id] ?? false}
										onchange={() => togglePick(ability.id)}
										class="mt-1 accent-(--app-accent)"
									/>
									<span>
										<span class="block font-semibold">{ability.name}</span>
										{#if 'description' in ability && ability.description}
											<span class="block text-sm text-muted">{ability.description}</span>
										{/if}
									</span>
								</label>
							</li>
						{/each}
					</ul>
					{#if setting.flags.allowCustomAbilities}
						<div class="mt-5 flex gap-2 border-t border-edge pt-4">
							<input class="field flex-1" bind:value={newAbilityName} placeholder="Custom {setting.abilitiesLabel?.toLowerCase() ?? 'ability'} name" />
							<button class="btn-ghost" onclick={addCustomAbility}>Add</button>
						</div>
					{/if}
				{/if}
			{:else if stepName === 'Review'}
				{@const preview = buildData()}
				<div class="space-y-4">
					<div class="flex items-center gap-4">
						{#if imagePreview}
							<img src={imagePreview} alt="Portrait" class="h-16 w-16 rounded-md border border-edge object-cover" />
						{/if}
						<div>
							<p class="font-display text-xl font-bold">{name}</p>
							{#if playerName}<p class="text-sm text-muted">played by {playerName}</p>{/if}
							{#if background}<p class="text-sm text-accent">{background.name}</p>{/if}
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<p class="text-xs tracking-wide text-muted uppercase">Attributes</p>
							<ul class="mt-1 space-y-0.5 text-sm">
								{#each setting.attributes as attr (attr.id)}
									<li class="flex justify-between"><span>{attr.name}</span><span class="font-mono">{attributes[attr.id]}</span></li>
								{/each}
							</ul>
							<p class="mt-3 text-xs tracking-wide text-muted uppercase">Resources</p>
							<ul class="mt-1 space-y-0.5 text-sm">
								{#each setting.resources as res (res.id)}
									<li class="flex justify-between">
										<span>{res.name}</span>
										<span class="font-mono">{preview.resources[res.id]?.max?.toLocaleString()}</span>
									</li>
								{/each}
							</ul>
						</div>
						<div>
							<p class="text-xs tracking-wide text-muted uppercase">Skills</p>
							<ul class="mt-1 space-y-0.5 text-sm">
								{#each preview.skills as skill (skill.id)}
									<li class="flex justify-between"><span>{skill.name}</span><span class="font-mono">{skill.rank}</span></li>
								{:else}
									<li class="text-muted">None</li>
								{/each}
							</ul>
							<p class="mt-3 text-xs tracking-wide text-muted uppercase">{setting.abilitiesLabel ?? 'Abilities'}</p>
							<ul class="mt-1 space-y-0.5 text-sm">
								{#each preview.abilities as ability (ability.id)}
									<li class="flex justify-between"><span>{ability.name}</span><span class="font-mono">{ability.rank}</span></li>
								{:else}
									<li class="text-muted">None</li>
								{/each}
							</ul>
						</div>
					</div>

					{#if submitError}<p class="text-sm text-danger">{submitError}</p>{/if}
				</div>
			{/if}
		</div>

		<div class="mt-4 flex justify-between">
			<button class="btn-ghost" onclick={() => (stepIndex = Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>
				Back
			</button>
			{#if stepName === 'Review'}
				<button class="btn-primary" onclick={finish} disabled={submitting}>
					{submitting ? 'Creating…' : 'Create character'}
				</button>
			{:else}
				<button
					class="btn-primary"
					onclick={() => (stepIndex = Math.min(steps.length - 1, stepIndex + 1))}
					disabled={!canLeaveStep()}
				>
					Next
				</button>
			{/if}
		</div>
	</div>
{/if}
