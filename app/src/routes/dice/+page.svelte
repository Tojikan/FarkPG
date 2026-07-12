<script lang="ts">
	import DiceRoller from '$lib/components/dice/DiceRoller.svelte';
</script>

<svelte:head><title>Dice Roller · FarkPG</title></svelte:head>

<h1 class="font-display text-2xl font-bold">Dice Roller</h1>
<p class="mt-1 mb-4 text-sm text-muted">
	Roll a pool of d6s, select the ones you want, and drag them into the score area.
</p>

<DiceRoller />
