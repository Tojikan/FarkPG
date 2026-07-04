<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let creating = $state(false);
	let showCreate = $state(false);

	function settingName(id: string) {
		return data.settings.find((s) => s.id === id)?.name ?? id;
	}
</script>

<svelte:head><title>Campaigns · FarkPG</title></svelte:head>

<div class="flex items-center justify-between">
	<h1 class="font-display text-2xl font-bold">Your campaigns</h1>
	<button class="btn-primary" onclick={() => (showCreate = !showCreate)}>
		{showCreate ? 'Cancel' : 'New campaign'}
	</button>
</div>

{#if showCreate}
	<form
		method="POST"
		action="?/create"
		class="card mt-4 space-y-4"
		use:enhance={() => {
			creating = true;
			return async ({ update, result }) => {
				creating = false;
				if (result.type === 'success') showCreate = false;
				await update();
			};
		}}
	>
		<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
			<input class="field" name="name" placeholder="Campaign name" required maxlength="80" />
			<label class="flex items-center gap-2 text-sm text-muted">
				Player slots
				<input class="field w-20" type="number" name="max_characters" value="6" min="1" max="50" />
			</label>
		</div>

		<fieldset>
			<legend class="mb-2 text-sm text-muted">Setting</legend>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each data.settings as setting (setting.id)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-md border border-edge-strong p-3
							has-checked:border-accent has-checked:bg-raised"
					>
						<input type="radio" name="setting_id" value={setting.id} required class="mt-1 accent-(--app-accent)" />
						<span>
							<span class="block font-semibold">{setting.name}</span>
							{#if setting.tagline}<span class="block text-sm text-muted">{setting.tagline}</span>{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if form?.message}<p class="text-sm text-danger">{form.message}</p>{/if}
		<button type="submit" class="btn-primary" disabled={creating}>
			{creating ? 'Creating…' : 'Create campaign'}
		</button>
	</form>
{/if}

{#if data.campaigns.length === 0}
	<div class="card mt-6 text-center text-muted">
		No campaigns yet. Create one to get a join code for your players.
	</div>
{:else}
	<ul class="mt-6 grid gap-3 sm:grid-cols-2">
		{#each data.campaigns as campaign (campaign.id)}
			<li>
				<a href="/campaign/{campaign.id}" class="card block transition-colors hover:border-accent">
					<div class="flex items-baseline justify-between gap-2">
						<span class="font-display text-lg font-bold">{campaign.name}</span>
						<span class="rounded bg-raised px-2 py-0.5 font-mono text-sm tracking-widest text-accent">
							{campaign.campaign_code}
						</span>
					</div>
					<p class="mt-1 text-sm text-muted">
						{settingName(campaign.setting_id)} ·
						{campaign.characterCount}/{campaign.max_characters} characters
					</p>
				</a>
			</li>
		{/each}
	</ul>
{/if}
