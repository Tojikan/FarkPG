<script lang="ts">
	import { enhance } from '$app/forms';
	import { characterImageUrl } from '$lib/images';
	import type { CharacterData } from '$lib/character';

	let { data, form } = $props();

	let editingSettings = $state(false);
	let revealedCodes = $state<Record<string, boolean>>({});
	let expanded = $state<Record<string, boolean>>({});
	let copied = $state(false);

	const joinUrl = $derived(`${typeof location !== 'undefined' ? location.origin : ''}/join`);

	function charData(c: { data: unknown }): CharacterData {
		return c.data as CharacterData;
	}

	async function copyCode() {
		await navigator.clipboard.writeText(data.campaign.campaign_code);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<svelte:head><title>{data.campaign.name} · FarkPG</title></svelte:head>

<div data-setting={data.campaign.setting_id}>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="font-display text-2xl font-bold">{data.campaign.name}</h1>
			<p class="mt-1 text-sm text-muted">
				{data.setting.name} · {data.characters.length}/{data.campaign.max_characters} characters
			</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="/campaign/{data.campaign.id}/items" class="btn-ghost">Items</a>
			<button class="btn-ghost" onclick={() => (editingSettings = !editingSettings)}>
				{editingSettings ? 'Close settings' : 'Settings'}
			</button>
		</div>
	</div>

	<div class="card mt-4 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xs tracking-wide text-muted uppercase">Campaign code</p>
			<button
				class="cursor-pointer font-mono text-2xl font-bold tracking-[0.3em] text-accent"
				onclick={copyCode}
				title="Copy to clipboard"
			>
				{data.campaign.campaign_code}
			</button>
			{#if copied}<span class="ml-2 text-sm text-muted">copied</span>{/if}
		</div>
		<p class="text-sm text-muted">
			Players enter this at <span class="font-mono text-ink">{joinUrl}</span>
		</p>
	</div>

	{#if editingSettings}
		<form method="POST" action="?/updateCampaign" class="card mt-4 space-y-3" use:enhance>
			<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
				<input class="field" name="name" value={data.campaign.name} required maxlength="80" />
				<label class="flex items-center gap-2 text-sm text-muted">
					Player slots
					<input
						class="field w-20"
						type="number"
						name="max_characters"
						value={data.campaign.max_characters}
						min="1"
						max="50"
					/>
				</label>
			</div>
			<textarea class="field min-h-28" name="notes" placeholder="Campaign notes (only you see these)"
				>{data.campaign.notes}</textarea
			>
			{#if form?.message}<p class="text-sm text-danger">{form.message}</p>{/if}
			<button type="submit" class="btn-primary">Save</button>
		</form>
	{:else if data.campaign.notes}
		<div class="card mt-4">
			<p class="text-xs tracking-wide text-muted uppercase">Notes</p>
			<p class="mt-1 text-sm whitespace-pre-wrap">{data.campaign.notes}</p>
		</div>
	{/if}

	<h2 class="mt-8 font-display text-lg font-bold">Characters</h2>
	{#if data.characters.length === 0}
		<div class="card mt-3 text-center text-muted">
			No characters yet. Share the campaign code and have players visit /join.
		</div>
	{:else}
		<ul class="mt-3 space-y-3">
			{#each data.characters as character (character.id)}
				{@const cd = charData(character)}
				<li class="card">
					<div class="flex flex-wrap items-center gap-4">
						{#if characterImageUrl(character.image_path)}
							<img
								src={characterImageUrl(character.image_path)}
								alt={character.name}
								class="h-14 w-14 rounded-md border border-edge object-cover"
							/>
						{:else}
							<div
								class="flex h-14 w-14 items-center justify-center rounded-md border border-edge bg-raised
									font-display text-xl text-muted"
							>
								{character.name.charAt(0).toUpperCase()}
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<a
								href="/campaign/{data.campaign.id}/character/{character.id}"
								class="font-display text-lg font-bold hover:text-accent"
							>
								{character.name}
							</a>
							{#if character.player_name}
								<p class="text-sm text-muted">played by {character.player_name}</p>
							{/if}
						</div>

						<div class="flex items-center gap-2">
							{#if revealedCodes[character.id]}
								<span class="rounded bg-raised px-2 py-1 font-mono text-sm tracking-widest text-accent">
									{character.character_code}
								</span>
							{:else}
								<button
									class="btn-ghost px-3 py-1 text-xs"
									onclick={() => (revealedCodes[character.id] = true)}
								>
									Reveal code
								</button>
							{/if}
							<button
								class="btn-ghost px-3 py-1 text-xs"
								onclick={() => (expanded[character.id] = !expanded[character.id])}
							>
								{expanded[character.id] ? 'Collapse' : 'Expand'}
							</button>
							<form
								method="POST"
								action="?/deleteCharacter"
								use:enhance
								onsubmit={(e) => {
									if (!confirm(`Remove ${character.name} from the campaign?`)) e.preventDefault();
								}}
							>
								<input type="hidden" name="character_id" value={character.id} />
								<button type="submit" class="btn px-3 py-1 text-xs text-danger hover:bg-danger/10">
									Remove
								</button>
							</form>
						</div>
					</div>

					{#if expanded[character.id]}
						<div class="mt-4 grid gap-4 border-t border-edge pt-4 sm:grid-cols-2">
							<div>
								<p class="text-xs tracking-wide text-muted uppercase">Attributes</p>
								<ul class="mt-1 space-y-1 text-sm">
									{#each data.setting.attributes as attr (attr.id)}
										<li class="flex justify-between">
											<span>{attr.name}</span>
											<span class="font-mono">{cd.attributes?.[attr.id] ?? '—'}</span>
										</li>
									{/each}
								</ul>
							</div>
							<div>
								<p class="text-xs tracking-wide text-muted uppercase">Skills</p>
								{#if (cd.skills ?? []).length === 0}
									<p class="mt-1 text-sm text-muted">None</p>
								{:else}
									<ul class="mt-1 space-y-1 text-sm">
										{#each cd.skills as skill (skill.id)}
											<li class="flex justify-between">
												<span>{skill.name}{skill.custom ? ' *' : ''}</span>
												<span class="font-mono">{skill.rank}</span>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
