<script lang="ts">
	import SheetEditor from '$lib/components/SheetEditor.svelte';
	import { mergeCharacterData, syncDerivedStats } from '$lib/data/character';
	import type { CharacterData } from '$lib/data/types';

	let { data } = $props();

	let characterName = $state('');
	let sheetData = $state<CharacterData | null>(null);

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

<section class="space-y-4 py-8">
	<p class="text-sm text-neutral-500">
		<a href="/campaigns" class="underline">Dashboard</a>
		{#if data.campaignId && data.campaignName}
			/ <a href="/campaigns/{data.campaignId}" class="underline">{data.campaignName}</a>
			/ <a href="/campaigns/{data.campaignId}/characters" class="underline">Characters</a>
		{/if}
	</p>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">{characterName || 'Unnamed character'}</h1>
			<p class="text-sm text-neutral-500">{data.theme.label}</p>
		</div>
		{#if data.canEdit}
			<form method="POST" action="?/delete" onsubmit={(e) => !confirm('Delete this character?') && e.preventDefault()}>
				<button type="submit" class="btn btn-danger">Delete</button>
			</form>
		{/if}
	</div>

	{#if sheetData}
		<SheetEditor
			theme={data.theme}
			bind:characterName
			bind:data={sheetData}
			readonly={!data.canEdit}
			onsave={data.canEdit ? handleSave : undefined}
		/>
	{/if}
</section>
