<script lang="ts">
	import { enhance } from '$app/forms';
	import { themeList } from '$lib/data/themes';

	let { data, form } = $props();
</script>

<section class="space-y-6 py-8">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="text-sm text-neutral-500">
				<a href="/campaigns" class="underline">Dashboard</a> /
				<a href="/campaigns/{data.campaignId}" class="underline">{data.campaignName}</a>
			</p>
			<h1 class="text-2xl font-bold">Characters</h1>
		</div>
	</div>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	<div class="card space-y-4">
		<h2 class="text-lg font-semibold">New character</h2>
		<form method="POST" action="?/create" use:enhance class="flex flex-wrap items-end gap-3">
			<div class="min-w-48 flex-1">
				<label class="field-label" for="name">Name</label>
				<input class="field-input" id="name" name="name" type="text" required />
			</div>
			<div class="min-w-48">
				<label class="field-label" for="themeId">Theme</label>
				<select class="field-input" id="themeId" name="themeId" required>
					{#each themeList as theme}
						<option value={theme.id}>{theme.label}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="btn btn-primary">Create</button>
		</form>
	</div>

	<div class="space-y-3">
		<h2 class="text-lg font-semibold">{data.isGm ? 'All characters' : 'Your characters'}</h2>
		{#if data.characters.length === 0}
			<p class="text-neutral-600">No characters yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.characters as character}
					<li class="card flex flex-wrap items-center justify-between gap-3">
						<div>
							<a href="/characters/{character.id}" class="text-lg font-medium underline">
								{character.name || 'Unnamed'}
							</a>
							<p class="text-sm text-neutral-500">
								{character.theme_id}
								{#if data.isGm && character.owner_name}
									· {character.owner_name}
								{/if}
							</p>
						</div>
						<a href="/characters/{character.id}" class="btn btn-secondary">Open</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
