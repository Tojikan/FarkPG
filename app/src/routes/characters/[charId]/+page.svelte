<script lang="ts">
	import SheetEditor from '$lib/components/SheetEditor.svelte';
	import { mergeCharacterData, syncDerivedStats } from '$lib/data/character';
	import type { CharacterData } from '$lib/data/types';

	let { data } = $props();

	let characterName = $state('');
	let sheetData = $state<CharacterData | null>(null);

	const backHref = $derived(data.campaignId ? `/campaigns/${data.campaignId}` : '/campaigns');
	const backLabel = $derived(data.campaignName ? `Back to ${data.campaignName}` : 'Back to Dashboard');
	const viewOnly = $derived(!data.canEdit);

	$effect(() => {
		characterName = data.character.name;
		sheetData = mergeCharacterData(data.character.data as CharacterData, data.theme);
	});

	async function handleSave(payload: { name: string; data: CharacterData }) {
		const synced = syncDerivedStats(payload.data, data.theme);
		const res = await fetch(`/characters/${data.character.id}/save`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: payload.name, data: synced })
		});

		if (!res.ok) {
			throw new Error('Save failed');
		}
	}
</script>

<div class="sheet-page">
	<div class="sheet-page-inner">
		<a href={backHref} class="back-link">
			<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
			{backLabel}
		</a>

		{#if viewOnly}
			<p class="view-only-banner">View only — you can browse this sheet but cannot make changes.</p>
		{/if}

		{#if sheetData}
			<div class="sheet-page-body">
				<SheetEditor
					theme={data.theme}
					characterId={data.character.id}
					bind:characterName
					bind:data={sheetData}
					readonly={!data.canEdit}
					onsave={data.canEdit ? handleSave : undefined}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.sheet-page {
		min-height: calc(100vh - 3.5rem);
		background: #0a0e14;
		padding: 0.75rem var(--gutter-padding) 2rem;
	}

	.sheet-page-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1rem;
		font-size: 0.82rem;
		color: #8899aa;
		text-decoration: none;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: #5dade2;
	}

	.view-only-banner {
		margin: 0 0 1rem;
		padding: 0.55rem 0.75rem;
		border-radius: 0.375rem;
		background: rgba(93, 173, 226, 0.1);
		border: 1px solid rgba(93, 173, 226, 0.25);
		color: #a8d4f0;
		font-size: 0.8rem;
	}

	.sheet-page-body :global(.sheet-view) {
		border: 1px solid #2d3a4d;
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.03),
			0 16px 48px rgba(0, 0, 0, 0.45);
	}
</style>
