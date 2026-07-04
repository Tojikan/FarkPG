<script lang="ts">
	import CreateWizard from '$lib/components/CreateWizard.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Create character · {data.campaign.name} · FarkPG</title></svelte:head>

<p class="mb-2 text-sm text-muted">
	<a href="/campaign/{data.campaign.id}" class="hover:text-accent">← {data.campaign.name}</a>
	· {data.slotsRemaining} slot{data.slotsRemaining === 1 ? '' : 's'} left
</p>

<CreateWizard
	campaignCode={data.campaign.campaign_code}
	campaignName={data.campaign.name}
	setting={data.setting}
	mode="gm"
	gmCampaignId={data.campaign.id}
	cancelHref="/campaign/{data.campaign.id}"
/>
