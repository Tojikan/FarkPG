<script lang="ts">
	import { page } from '$app/state';
	import { createClient } from '$lib/supabase/client';
	import { getSetting } from '$lib/settings';
	import { rememberCodes } from '$lib/playerCodes';
	import Sheet from '$lib/components/Sheet.svelte';
	import type { SettingDefinition } from '$lib/settings/types';
	import type { CharacterData } from '$lib/character';

	const supabase = createClient();
	const campaignCode = page.params.campaignCode!.toUpperCase();
	const characterCode = page.params.characterCode!.toUpperCase();

	interface Loaded {
		id: string;
		name: string;
		player_name: string;
		image_path: string | null;
		data: CharacterData;
		campaign: { name: string; setting_id: string };
	}

	let loaded = $state<Loaded | null>(null);
	let setting = $state<SettingDefinition | null>(null);
	let items = $state<{ id: string; name: string; description: string; data: Record<string, string | number> }[]>([]);
	let loadError = $state('');

	async function fetchCharacter(): Promise<Loaded | null> {
		const { data, error } = await supabase.rpc('load_character', {
			p_campaign_code: campaignCode,
			p_character_code: characterCode
		});
		if (error || !data) return null;
		return data as Loaded;
	}

	$effect(() => {
		(async () => {
			const character = await fetchCharacter();
			if (!character) {
				loadError = 'Character not found. Check your campaign and character codes.';
				return;
			}
			try {
				setting = getSetting(character.campaign.setting_id);
			} catch {
				loadError = 'This campaign uses a setting this app does not know.';
				return;
			}
			loaded = character;
			rememberCodes({ campaignCode, characterCode, name: character.name });

			const { data: itemList } = await supabase.rpc('list_campaign_items', {
				p_campaign_code: campaignCode,
				p_character_code: characterCode
			});
			items = itemList ?? [];
		})();
	});

	async function save(state: {
		name: string;
		player_name: string;
		image_path: string | null;
		data: CharacterData;
	}): Promise<boolean> {
		const { error } = await supabase.rpc('save_character', {
			p_campaign_code: campaignCode,
			p_character_code: characterCode,
			p_name: state.name,
			p_player_name: state.player_name,
			p_image_path: state.image_path,
			p_data: state.data
		});
		if (!error) rememberCodes({ campaignCode, characterCode, name: state.name });
		return !error;
	}

	async function refetch() {
		return await fetchCharacter();
	}
</script>

<svelte:head><title>{loaded?.name ?? 'Character sheet'} · FarkPG</title></svelte:head>

{#if loadError}
	<div class="card mx-auto mt-16 max-w-md text-center">
		<p class="text-danger">{loadError}</p>
		<a href="/join" class="btn-ghost mt-4">Back to join</a>
	</div>
{:else if !loaded || !setting}
	<p class="mt-16 text-center text-muted">Loading character…</p>
{:else}
	<p class="mb-2 text-sm text-muted">{loaded.campaign.name} · {setting.name}</p>
	<Sheet
		{setting}
		characterId={loaded.id}
		initial={{
			name: loaded.name,
			player_name: loaded.player_name,
			image_path: loaded.image_path,
			data: loaded.data
		}}
		{items}
		mode="player"
		{save}
		{refetch}
	/>
{/if}
