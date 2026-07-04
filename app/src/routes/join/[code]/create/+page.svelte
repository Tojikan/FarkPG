<script lang="ts">
	import { page } from '$app/state';
	import { createClient } from '$lib/supabase/client';
	import { getSetting } from '$lib/settings';
	import CreateWizard from '$lib/components/CreateWizard.svelte';

	const supabase = createClient();
	const campaignCode = page.params.code!.toUpperCase();

	let setting = $state<ReturnType<typeof getSetting> | null>(null);
	let campaignName = $state('');
	let bootError = $state('');

	$effect(() => {
		supabase.rpc('join_campaign', { p_campaign_code: campaignCode }).then(({ data, error }) => {
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
				setting = getSetting(data.setting_id);
			} catch {
				bootError = 'This campaign uses a setting this app does not know.';
			}
		});
	});
</script>

<svelte:head><title>Create character · FarkPG</title></svelte:head>

{#if bootError}
	<div class="card mx-auto mt-16 max-w-md text-center">
		<p class="text-danger">{bootError}</p>
		<a href="/join" class="btn-ghost mt-4">Back to join</a>
	</div>
{:else if !setting}
	<p class="mt-16 text-center text-muted">Loading campaign…</p>
{:else}
	<CreateWizard
		{campaignCode}
		{campaignName}
		{setting}
		mode="player"
		cancelHref="/join"
	/>
{/if}
