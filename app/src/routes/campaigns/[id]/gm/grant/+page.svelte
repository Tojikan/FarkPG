<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<section class="space-y-6 py-8">
	<p class="text-sm text-neutral-500">
		<a href="/campaigns" class="underline">Campaigns</a> /
		<a href="/campaigns/{data.campaignId}" class="underline">{data.campaignName}</a> /
		GM · Grant items
	</p>

	<h1 class="text-2xl font-bold">Grant item to character</h1>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}
	{#if form?.success}
		<p class="alert-success">Item granted.</p>
	{/if}

	<form method="POST" use:enhance class="card max-w-lg space-y-4">
		<div>
			<label class="field-label" for="characterId">Character</label>
			<select class="field-input" id="characterId" name="characterId" required>
				<option value="">Select character…</option>
				{#each data.characters as character}
					<option value={character.id}>{character.name || 'Unnamed'}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="field-label" for="itemId">Item</label>
			<select class="field-input" id="itemId" name="itemId" required>
				<option value="">Select item…</option>
				{#each data.items as item}
					<option value={item.id}>{item.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="field-label" for="quantity">Quantity</label>
			<input class="field-input" id="quantity" name="quantity" type="number" min="1" value="1" />
		</div>
		<button type="submit" class="btn btn-primary">Grant item</button>
	</form>
</section>
