<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import Sheet from '$lib/components/Sheet.svelte';
	import type { CharacterData } from '$lib/character';

	let { data } = $props();

	const saveUrl = $derived(
		`/campaign/${page.params.id}/character/${page.params.charId}/save`
	);

	async function save(state: {
		name: string;
		player_name: string;
		image_path: string | null;
		data: CharacterData;
	}): Promise<boolean> {
		const res = await fetch(saveUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(state)
		});
		return res.ok;
	}

	async function refetch() {
		await invalidateAll();
		return {
			name: data.character.name,
			player_name: data.character.player_name,
			image_path: data.character.image_path,
			data: data.character.data as CharacterData
		};
	}
</script>

<svelte:head><title>{data.character.name} · {data.campaign.name} · FarkPG</title></svelte:head>

<div class="mb-2 flex items-center justify-between text-sm">
	<a href="/campaign/{data.campaign.id}" class="text-muted hover:text-accent">
		← {data.campaign.name}
	</a>
	<span class="font-mono text-xs tracking-widest text-muted">
		code: {data.character.character_code}
	</span>
</div>

<Sheet
	setting={data.setting}
	characterId={data.character.id}
	initial={{
		name: data.character.name,
		player_name: data.character.player_name,
		image_path: data.character.image_path,
		data: data.character.data as CharacterData
	}}
	items={data.items}
	mode="gm"
	{save}
	{refetch}
/>
