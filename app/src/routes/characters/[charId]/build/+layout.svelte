<script lang="ts">
	import { setContext } from 'svelte';
	import { BUILD_CTX, type BuildStore } from '$lib/build/context';
	import { normalizeBuilderSkillSpend, cloneSheetData } from '$lib/data/character';

	let { data, children } = $props();

	const build = $state<BuildStore>({
		characterId: data.characterId,
		theme: data.theme,
		characterName: data.characterName,
		sheetData: normalizeBuilderSkillSpend(cloneSheetData(data.sheetData), data.theme)
	});

	setContext(BUILD_CTX, build);
</script>

{@render children()}
