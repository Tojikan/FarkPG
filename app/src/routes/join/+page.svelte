<script lang="ts">
	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase/client';
	import { loadSavedCodes, forgetCodes, type SavedCharacterCodes } from '$lib/playerCodes';

	const supabase = createClient();

	let saved = $state<SavedCharacterCodes[]>(loadSavedCodes());
	let campaignCode = $state('');
	let characterCode = $state('');
	let checking = $state(false);
	let errorMessage = $state('');

	interface CampaignInfo {
		campaign_code: string;
		name: string;
		setting_id: string;
		max_characters: number;
		used_slots: number;
		slots_available: boolean;
	}
	let campaign = $state<CampaignInfo | null>(null);

	async function checkCampaign(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		campaign = null;
		checking = true;
		const { data, error } = await supabase.rpc('join_campaign', {
			p_campaign_code: campaignCode.trim().toUpperCase()
		});
		checking = false;
		if (error || !data) {
			errorMessage = 'No campaign found with that code.';
			return;
		}
		campaign = data as CampaignInfo;
	}

	function openSheet(e: SubmitEvent) {
		e.preventDefault();
		if (!campaign || !characterCode.trim()) return;
		goto(`/sheet/${campaign.campaign_code}/${characterCode.trim().toUpperCase()}`);
	}

	function forget(entry: SavedCharacterCodes) {
		forgetCodes(entry);
		saved = loadSavedCodes();
	}
</script>

<svelte:head><title>Join a campaign · FarkPG</title></svelte:head>

<div class="mx-auto mt-10 max-w-md">
	{#if saved.length > 0}
		<div class="card mb-6">
			<h2 class="font-display text-lg font-bold">Your characters</h2>
			<ul class="mt-2 space-y-2">
				{#each saved as entry (entry.campaignCode + entry.characterCode)}
					<li class="flex items-center justify-between gap-2">
						<a
							href="/sheet/{entry.campaignCode}/{entry.characterCode}"
							class="flex-1 rounded-md border border-edge-strong px-3 py-2 text-sm hover:border-accent"
						>
							<span class="font-semibold">{entry.name}</span>
							<span class="ml-2 font-mono text-xs text-muted">{entry.campaignCode}</span>
						</a>
						<button
							class="text-xs text-muted hover:text-danger"
							onclick={() => forget(entry)}
							title="Forget this character on this device"
						>
							forget
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="card">
		<h1 class="font-display text-xl font-bold">Join a campaign</h1>
		<p class="mt-1 text-sm text-muted">Enter the campaign code your GM gave you.</p>

		<form class="mt-4 flex gap-2" onsubmit={checkCampaign}>
			<input
				class="field flex-1 font-mono tracking-[0.3em] uppercase"
				bind:value={campaignCode}
				placeholder="ABC123"
				maxlength="6"
				required
			/>
			<button type="submit" class="btn-primary" disabled={checking}>
				{checking ? '…' : 'Find'}
			</button>
		</form>
		{#if errorMessage}<p class="mt-2 text-sm text-danger">{errorMessage}</p>{/if}
	</div>

	{#if campaign}
		<div class="card mt-4" data-setting={campaign.setting_id}>
			<h2 class="font-display text-lg font-bold text-accent">{campaign.name}</h2>
			<p class="text-sm text-muted">
				{campaign.used_slots}/{campaign.max_characters} character slots used
			</p>

			<div class="mt-4 space-y-4">
				{#if campaign.slots_available}
					<a href="/join/{campaign.campaign_code}/create" class="btn-primary w-full">
						Create a new character
					</a>
				{:else}
					<p class="rounded-md bg-raised px-3 py-2 text-sm text-muted">
						This campaign is full — you can still open an existing character below.
					</p>
				{/if}

				<form class="space-y-2" onsubmit={openSheet}>
					<p class="text-sm text-muted">Already have a character code?</p>
					<div class="flex gap-2">
						<input
							class="field flex-1 font-mono tracking-[0.2em] uppercase"
							bind:value={characterCode}
							placeholder="CHARACTER CODE"
							maxlength="8"
						/>
						<button type="submit" class="btn-ghost">Open sheet</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
