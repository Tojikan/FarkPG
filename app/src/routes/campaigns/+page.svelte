<script lang="ts">
	import { enhance } from '$app/forms';
	import { themeList } from '$lib/data/themes';

	let { data, form } = $props();
</script>

<section class="space-y-8 py-8">
	<h1 class="text-2xl font-bold">Dashboard</h1>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	<div class="space-y-3">
		<h2 class="text-lg font-semibold">Your characters</h2>

		<div class="card space-y-4">
			<h3 class="font-medium">New character</h3>
			<form method="POST" action="?/createCharacter" use:enhance class="flex flex-wrap items-end gap-3">
				<div class="min-w-48 flex-1">
					<label class="field-label" for="charName">Name</label>
					<input class="field-input" id="charName" name="name" type="text" required />
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

		{#if data.characters.length === 0}
			<p class="text-neutral-600">No characters yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.characters as character (character.id)}
					<li class="card flex flex-wrap items-center justify-between gap-3">
						<div>
							<a href="/characters/{character.id}" class="text-lg font-medium underline">
								{character.name || 'Unnamed'}
							</a>
							<p class="text-sm text-neutral-500">
								{character.theme_id}
								·
								{#if character.campaign_name}
									{character.campaign_name}
								{:else}
									<span class="italic">No campaign</span>
								{/if}
							</p>
						</div>
						<a href="/characters/{character.id}" class="btn btn-secondary">Open</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="card space-y-4">
			<h2 class="text-lg font-semibold">Create campaign</h2>
			<p class="text-sm text-neutral-600">You will be the GM. Share the invite code with players.</p>
			<form method="POST" action="?/create" use:enhance class="space-y-3">
				<div>
					<label class="field-label" for="name">Campaign name</label>
					<input class="field-input" id="name" name="name" type="text" required />
				</div>
				<button type="submit" class="btn btn-primary">Create</button>
			</form>
		</div>

		<div class="card space-y-4">
			<h2 class="text-lg font-semibold">Join campaign</h2>
			<p class="text-sm text-neutral-600">Enter the invite code from your GM.</p>
			<form method="POST" action="?/join" use:enhance class="space-y-3">
				<div>
					<label class="field-label" for="inviteCode">Invite code</label>
					<input class="field-input" id="inviteCode" name="inviteCode" type="text" required />
				</div>
				<button type="submit" class="btn btn-secondary">Join</button>
			</form>
		</div>
	</div>

	<div class="space-y-3">
		<h2 class="text-lg font-semibold">Your campaigns</h2>
		{#if data.campaigns.length === 0}
			<p class="text-neutral-600">No campaigns yet. Create one or join with an invite code.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.campaigns as campaign (campaign.id)}
					<li class="card flex flex-wrap items-center justify-between gap-3">
						<div>
							<a href="/campaigns/{campaign.id}" class="text-lg font-medium underline">{campaign.name}</a>
							{#if campaign.role === 'gm'}
								<span class="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">GM</span>
							{/if}
						</div>
						<a href="/campaigns/{campaign.id}" class="btn btn-secondary">Open</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
