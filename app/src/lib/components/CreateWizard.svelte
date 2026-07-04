<script lang="ts">
	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase/client';
	import { skillsByAttribute } from '$lib/settings';
	import {
		attributePointsSpent,
		nextStepCost,
		prevStepCost,
		nextSkillRankCost,
		prevSkillRankCost,
		poolPointLabel,
		rankTotalCost
	} from '$lib/settings/costs';
	import { syncDerived, uid, type CharacterData } from '$lib/character';
	import { rememberCodes } from '$lib/playerCodes';
	import type { SettingDefinition } from '$lib/settings/types';

	let {
		campaignCode,
		campaignName,
		setting,
		mode,
		gmCampaignId,
		cancelHref
	}: {
		campaignCode: string;
		campaignName: string;
		setting: SettingDefinition;
		mode: 'player' | 'gm';
		gmCampaignId?: string;
		cancelHref: string;
	} = $props();

	const supabase = createClient();

	let stepIndex = $state(0);
	let name = $state('');
	let playerName = $state('');
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let backgroundId = $state<string | null>(null);
	let attributes = $state(
		Object.fromEntries(setting.attributes.map((a) => [a.id, setting.creation.attributes.start]))
	);
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
	let result = $state<{ id: string; character_code: string } | null>(null);

	const steps = $derived.by(() => {
		const list = ['Name'];
		if (setting.backgrounds?.length) list.push('Background');
		list.push('Attributes', 'Skills', setting.abilitiesLabel ?? 'Abilities', 'Review');
		return list;
	});
	const stepName = $derived(steps[stepIndex] ?? '');

	const background = $derived(setting.backgrounds?.find((b) => b.id === backgroundId) ?? null);
	function poolBonus(pool: 'attributes' | 'skills' | 'abilities') {
		return background?.bonus.pool === pool ? background.bonus.amount : 0;
	}

	const attrRules = $derived(setting.creation.attributes);
	const attrPool = $derived(attrRules.pool + poolBonus('attributes'));
	const attrSpent = $derived(attributePointsSpent(attrRules, attributes));
	const attrRemaining = $derived(attrPool - attrSpent);

	const skillRules = $derived(setting.creation.skills);
	const skillPool = $derived(skillRules.pool + poolBonus('skills'));
	const skillSpent = $derived(
		Object.values(skillRanks).reduce(
			(sum, rank) => sum + rankTotalCost(skillRules.rankCosts, rank),
			0
		)
	);
	const skillRemaining = $derived(skillPool - skillSpent);

	const abilityRules = $derived(setting.creation.abilities);
	const abilityPool = $derived((abilityRules.pool ?? 0) + poolBonus('abilities'));
	const abilitySpent = $derived(
		Object.values(abilityRanks).reduce(
			(sum, rank) => sum + rankTotalCost(abilityRules.rankCosts ?? [], rank),
			0
		)
	);
	const abilityRemaining = $derived(abilityPool - abilitySpent);
	const pickedCount = $derived(Object.values(pickedAbilities).filter(Boolean).length);
	const pickLimit = $derived((abilityRules.count ?? 0) + poolBonus('abilities'));

	const stepComplete = $derived.by(() =>
		steps.map((label) => {
			if (label === 'Name') return name.trim().length > 0;
			if (label === 'Background') return backgroundId != null;
			if (label === 'Attributes') return attrRemaining === 0;
			if (label === 'Skills') return skillRemaining === 0;
			if (label === 'Review') return false;
			// Abilities step (label varies by setting, e.g. "Magic")
			if (abilityRules.mode === 'point-buy') return abilityRemaining === 0;
			return pickedCount === pickLimit;
		})
	);
	const canFinish = $derived(stepComplete.slice(0, -1).every(Boolean));

	function goToStep(i: number) {
		if (i === stepIndex) return;
		stepIndex = i;
	}

	function nextStep() {
		if (stepIndex < steps.length - 1) stepIndex++;
	}

	function backStep() {
		stepIndex = Math.max(0, stepIndex - 1);
	}

	function bumpAttribute(id: string, delta: 1 | -1) {
		const next = attributes[id] + delta;
		if (next < attrRules.min || next > attrRules.max) return;
		if (delta === 1) {
			const cost = attributePointsSpent(attrRules, { ...attributes, [id]: next }) - attrSpent;
			if (cost > attrRemaining) return;
		}
		attributes[id] = next;
	}

	function attributeDecreaseGain(id: string): number {
		const current = attributes[id];
		return prevStepCost(attrRules, current);
	}

	function bumpSkill(id: string, delta: 1 | -1) {
		const current = skillRanks[id] ?? 0;
		const next = current + delta;
		if (next < 0 || next > skillRules.maxRank) return;
		const cost =
			rankTotalCost(skillRules.rankCosts, next) - rankTotalCost(skillRules.rankCosts, current);
		if (delta === 1 && cost > skillRemaining) return;
		skillRanks[id] = next;
	}

	function bumpAbility(id: string, delta: 1 | -1) {
		if (!abilityRules.rankCosts || abilityRules.maxRank == null) return;
		const current = abilityRanks[id] ?? 0;
		const next = current + delta;
		if (next < 0 || next > abilityRules.maxRank) return;
		const cost =
			rankTotalCost(abilityRules.rankCosts, next) -
			rankTotalCost(abilityRules.rankCosts, current);
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
		const id = `custom-${uid()}`;
		customAbilities.push({ id, name: trimmed });
		newAbilityName = '';
	}

	function onImagePicked(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0] ?? null;
		imageFile = file;
		imagePreview = file ? URL.createObjectURL(file) : null;
	}

	function buildData(): CharacterData {
		const allSkills = [
			...setting.skills.map((def) => ({ def, custom: false })),
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
			abilityRules.mode === 'point-buy'
				? setting.abilities
						.filter((a) => (abilityRanks[a.id] ?? 0) > 0)
						.map((a) => ({
							id: a.id,
							name: a.name,
							rank: abilityRanks[a.id],
							description: a.description
						}))
				: [
						...setting.abilities
							.filter((a) => pickedAbilities[a.id])
							.map((a) => ({ id: a.id, name: a.name, rank: 1, description: a.description })),
						...customAbilities
							.filter((a) => pickedAbilities[a.id])
							.map((a) => ({ id: a.id, name: a.name, rank: 1, custom: true }))
					];

		return syncDerived(setting, {
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

		result = data as { id: string; character_code: string };
		if (mode === 'player') {
			rememberCodes({
				campaignCode,
				characterCode: result.character_code,
				name: name.trim()
			});
		}
	}

	async function openCharacter() {
		if (!result) return;
		if (mode === 'gm' && gmCampaignId) {
			await goto(`/campaign/${gmCampaignId}/character/${result.id}`);
		} else {
			await goto(`/sheet/${campaignCode}/${result.character_code}`);
		}
	}
</script>

{#snippet pointsBadge(remaining: number, pool: number, label: string)}
	<div
		class="mb-4 rounded-lg border-2 px-4 py-3 text-center
			{remaining < 0
			? 'border-danger bg-danger/10'
			: remaining === 0
				? 'border-accent/60 bg-accent/5'
				: 'border-accent bg-accent/10'}"
	>
		<p class="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
		<p
			class="font-mono text-4xl font-bold tabular-nums
				{remaining < 0 ? 'text-danger' : 'text-accent'}"
		>
			{remaining}
		</p>
		<p class="text-xs text-muted">{pool - remaining} of {pool} spent</p>
	</div>
{/snippet}

{#if result}
	<div class="mx-auto mt-16 max-w-md" data-setting={setting.id}>
		<div class="card text-center">
			<h1 class="font-display text-2xl font-bold">{name} lives!</h1>
			<p class="mt-4 text-sm text-muted">
				{#if mode === 'gm'}
					Character created. Share this code with the player:
				{:else}
					Your character code — <strong class="text-ink">save this!</strong> It's how you get back to your sheet:
				{/if}
			</p>
			<p class="mt-3 rounded-md bg-raised py-4 font-mono text-3xl font-bold tracking-[0.3em] text-accent">
				{result.character_code}
			</p>
			<button type="button" class="btn-primary mt-6 w-full" onclick={openCharacter}>
				Open character sheet
			</button>
			{#if mode === 'gm' && gmCampaignId}
				<a href="/campaign/{gmCampaignId}" class="btn-ghost mt-2 w-full">Back to roster</a>
			{/if}
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-2xl" data-setting={setting.id}>
		<p class="text-sm text-muted">{campaignName} · {setting.name}</p>
		<h1 class="font-display text-2xl font-bold">
			{mode === 'gm' ? 'Create a character' : 'Create your character'}
		</h1>

		<!-- Step nav: jump to any step; dot shows complete vs incomplete -->
		<nav class="mt-4" aria-label="Creation steps">
			<ol class="flex flex-wrap gap-1.5">
				{#each steps as label, i (label)}
					{@const current = i === stepIndex}
					{@const complete = label === 'Review' ? canFinish : stepComplete[i]}
					<li>
						<button
							type="button"
							class="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
								transition-colors
								{current
								? 'bg-accent font-semibold text-accent-ink'
								: 'bg-raised text-ink hover:bg-accent/20 hover:text-accent'}"
							aria-current={current ? 'step' : undefined}
							onclick={() => goToStep(i)}
						>
							<span
								class="inline-block h-2 w-2 shrink-0 rounded-full
									{complete ? 'bg-accent' : 'border border-muted bg-transparent'}
									{current ? 'bg-accent-ink border-accent-ink' : ''}"
								aria-hidden="true"
								title={complete ? 'Complete' : 'Incomplete'}
							></span>
							{label}
						</button>
					</li>
				{/each}
			</ol>
		</nav>

		<div class="card mt-4">
			{#if stepName === 'Name'}
				<div class="space-y-3">
					<label class="block">
						<span class="text-sm text-muted">Character name</span>
						<input class="field mt-1" bind:value={name} maxlength="60" placeholder="Name" />
					</label>
					<label class="block">
						<span class="text-sm text-muted">
							{mode === 'gm' ? 'Player name (optional)' : 'Your name (optional)'}
						</span>
						<input class="field mt-1" bind:value={playerName} maxlength="60" placeholder="Player" />
					</label>
					<label class="block">
						<span class="text-sm text-muted">Portrait (optional)</span>
						<input class="field mt-1" type="file" accept="image/*" onchange={onImagePicked} />
					</label>
					{#if imagePreview}
						<img
							src={imagePreview}
							alt="Portrait preview"
							class="h-28 w-28 rounded-md border border-edge object-cover"
						/>
					{/if}
				</div>
			{:else if stepName === 'Background'}
				<div class="space-y-2">
					{#each setting.backgrounds ?? [] as bg (bg.id)}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-md border border-edge-strong p-3
								has-checked:border-accent has-checked:bg-raised"
						>
							<input
								type="radio"
								bind:group={backgroundId}
								value={bg.id}
								class="mt-1 accent-(--app-accent)"
							/>
							<span>
								<span class="block font-semibold">{bg.name}</span>
								<span class="block text-sm text-muted">{bg.description}</span>
								<span class="mt-1 block text-xs text-accent">
									+{bg.bonus.amount} {poolPointLabel(bg.bonus.pool)}
								</span>
							</span>
						</label>
					{/each}
				</div>
			{:else if stepName === 'Attributes'}
				{@render pointsBadge(attrRemaining, attrPool, 'Attribute points remaining')}
				<p class="mb-3 text-sm text-muted">
					{#if attrRules.mode === 'escalating'}
						Costs escalate as you raise attributes. Each point below {attrRules.start} refunds 1
						point.
					{:else}
						One point per step above or below the default.
					{/if}
				</p>
				<ul class="space-y-2">
					{#each setting.attributes as attr (attr.id)}
						{@const current = attributes[attr.id]}
						{@const upCost = nextStepCost(attrRules, current)}
						{@const decreaseGain = attributeDecreaseGain(attr.id)}
						<li class="flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-2 sm:gap-3">
							<div class="min-w-0 flex-1">
								<span class="font-semibold">{attr.name}</span>
								{#if attr.description}
									<span class="ml-2 hidden text-xs text-muted sm:inline">{attr.description}</span>
								{/if}
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-14 text-right text-[11px] tabular-nums text-muted">
									{#if decreaseGain > 0}
										+{decreaseGain} pt
									{/if}
								</span>
								<button
									type="button"
									class="btn-ghost h-8 w-8 p-0"
									onclick={() => bumpAttribute(attr.id, -1)}
									disabled={current <= attrRules.min}
								>
									−
								</button>
								<span class="w-6 text-center font-mono text-lg">{current}</span>
								<button
									type="button"
									class="btn-ghost h-8 w-8 p-0"
									onclick={() => bumpAttribute(attr.id, 1)}
									disabled={current >= attrRules.max || upCost > attrRemaining}
								>
									+
								</button>
								<span class="w-14 text-left text-[11px] tabular-nums text-accent">
									{#if current < attrRules.max && upCost > 0}
										−{upCost} pt
									{/if}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{:else if stepName === 'Skills'}
				{@render pointsBadge(skillRemaining, skillPool, 'Skill points remaining')}
				<p class="mb-3 text-sm text-muted">
					Skill can have {skillRules.maxRank} levels max. Each level increases cost.
				</p>
				{#each skillsByAttribute(setting) as group (group.attribute.id)}
					<h3 class="mt-4 font-display text-sm font-bold tracking-wide text-accent uppercase">
						{group.attribute.name}
					</h3>
					<ul class="mt-1 space-y-1">
						{#each [...group.skills, ...customSkills.filter((c) => c.attribute === group.attribute.id)] as skill (skill.id)}
							{@const rank = skillRanks[skill.id] ?? 0}
							{@const upCost = nextSkillRankCost(skillRules.rankCosts, rank, skillRules.maxRank)}
							{@const downRefund = prevSkillRankCost(skillRules.rankCosts, rank)}
							<li class="flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-1.5 sm:gap-3">
								<div class="min-w-0 flex-1">
									<span class="text-sm font-semibold">{skill.name}</span>
									{#if 'description' in skill && skill.description}
										<span class="ml-2 hidden text-xs text-muted lg:inline">{skill.description}</span>
									{/if}
								</div>
								<div class="flex items-center gap-1.5">
									<span class="w-12 text-right text-[11px] tabular-nums text-muted">
										{#if downRefund > 0}
											+{downRefund} pt
										{/if}
									</span>
									<button
										type="button"
										class="btn-ghost h-7 w-7 p-0 text-xs"
										onclick={() => bumpSkill(skill.id, -1)}
										disabled={rank <= 0}
									>
										−
									</button>
									<span class="w-4 text-center font-mono">{rank}</span>
									<button
										type="button"
										class="btn-ghost h-7 w-7 p-0 text-xs"
										onclick={() => bumpSkill(skill.id, 1)}
										disabled={rank >= skillRules.maxRank || upCost > skillRemaining}
									>
										+
									</button>
									<span class="w-12 text-left text-[11px] tabular-nums text-accent">
										{#if rank < skillRules.maxRank && upCost > 0}
											−{upCost} pt
										{/if}
									</span>
								</div>
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
						<button type="button" class="btn-ghost" onclick={addCustomSkill}>Add skill</button>
					</div>
				{/if}
			{:else if stepName === (setting.abilitiesLabel ?? 'Abilities')}
				{#if abilityRules.mode === 'point-buy'}
					{@render pointsBadge(abilityRemaining, abilityPool, 'Ability points remaining')}
					<p class="mb-3 text-sm text-muted">
						Rank {abilityRules.maxRank} max. Costs per rank: {abilityRules.rankCosts?.join(', ')}.
					</p>
					<ul class="space-y-2">
						{#each setting.abilities as ability (ability.id)}
							{@const rank = abilityRanks[ability.id] ?? 0}
							{@const upCost = nextSkillRankCost(
								abilityRules.rankCosts ?? [],
								rank,
								abilityRules.maxRank ?? 0
							)}
							{@const downRefund = prevSkillRankCost(abilityRules.rankCosts ?? [], rank)}
							<li class="flex flex-wrap items-center gap-2 rounded-md bg-raised px-3 py-2 sm:gap-3">
								<div class="min-w-0 flex-1">
									<span class="font-semibold">{ability.name}</span>
									{#if ability.description}
										<span class="ml-2 hidden text-xs text-muted sm:inline">{ability.description}</span>
									{/if}
								</div>
								<div class="flex items-center gap-1.5">
									<span class="w-12 text-right text-[11px] tabular-nums text-muted">
										{#if downRefund > 0}
											+{downRefund} pt
										{/if}
									</span>
									<button
										type="button"
										class="btn-ghost h-8 w-8 p-0"
										onclick={() => bumpAbility(ability.id, -1)}
										disabled={rank <= 0}
									>
										−
									</button>
									<span class="w-5 text-center font-mono">{rank}</span>
									<button
										type="button"
										class="btn-ghost h-8 w-8 p-0"
										onclick={() => bumpAbility(ability.id, 1)}
										disabled={rank >= (abilityRules.maxRank ?? 0) || upCost > abilityRemaining}
									>
										+
									</button>
									<span class="w-12 text-left text-[11px] tabular-nums text-accent">
										{#if rank < (abilityRules.maxRank ?? 0) && upCost > 0}
											−{upCost} pt
										{/if}
									</span>
								</div>
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
							<input
								class="field flex-1"
								bind:value={newAbilityName}
								placeholder="Custom {setting.abilitiesLabel?.toLowerCase() ?? 'ability'} name"
							/>
							<button type="button" class="btn-ghost" onclick={addCustomAbility}>Add</button>
						</div>
					{/if}
				{/if}
			{:else if stepName === 'Review'}
				{@const preview = buildData()}
				<div class="space-y-4">
					<div class="flex items-center gap-4">
						{#if imagePreview}
							<img
								src={imagePreview}
								alt="Portrait"
								class="h-16 w-16 rounded-md border border-edge object-cover"
							/>
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
									<li class="flex justify-between">
										<span>{attr.name}</span>
										<span class="font-mono">{attributes[attr.id]}</span>
									</li>
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
									<li class="flex justify-between">
										<span>{skill.name}</span>
										<span class="font-mono">{skill.rank}</span>
									</li>
								{:else}
									<li class="text-muted">None</li>
								{/each}
							</ul>
							<p class="mt-3 text-xs tracking-wide text-muted uppercase">
								{setting.abilitiesLabel ?? 'Abilities'}
							</p>
							<ul class="mt-1 space-y-0.5 text-sm">
								{#each preview.abilities as ability (ability.id)}
									<li class="flex justify-between">
										<span>{ability.name}</span>
										<span class="font-mono">{ability.rank}</span>
									</li>
								{:else}
									<li class="text-muted">None</li>
								{/each}
							</ul>
						</div>
					</div>

					{#if submitError}<p class="text-sm text-danger">{submitError}</p>{/if}
					{#if !canFinish}
						<p class="text-sm text-muted">
							Complete all steps before creating — check the steps marked incomplete above.
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
			<div class="flex gap-2">
				<a href={cancelHref} class="btn-ghost">Cancel</a>
				<button type="button" class="btn-ghost" onclick={backStep} disabled={stepIndex === 0}>
					Back
				</button>
			</div>
			{#if stepName === 'Review'}
				<button type="button" class="btn-primary" onclick={finish} disabled={submitting || !canFinish}>
					{submitting ? 'Creating…' : 'Create character'}
				</button>
			{:else}
				<button type="button" class="btn-primary" onclick={nextStep}>Next</button>
			{/if}
		</div>
	</div>
{/if}
