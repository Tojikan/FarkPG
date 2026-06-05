<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let editingId = $state<string | null>(null);
</script>

<section class="space-y-6 py-8">
	<p class="text-sm text-neutral-500">
		<a href="/campaigns" class="underline">Campaigns</a> /
		<a href="/campaigns/{data.campaignId}" class="underline">{data.campaignName}</a> /
		GM · Item store
	</p>

	<h1 class="text-2xl font-bold">Item store</h1>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	<div class="card space-y-4">
		<h2 class="text-lg font-semibold">{editingId ? 'Edit item' : 'New item'}</h2>
		<form
			method="POST"
			action={editingId ? '?/update' : '?/create'}
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					editingId = null;
				};
			}}
			class="grid gap-3 sm:grid-cols-2"
		>
			{#if editingId}
				<input type="hidden" name="itemId" value={editingId} />
			{/if}
			<div>
				<label class="field-label" for="name">Name</label>
				<input class="field-input" id="name" name="name" type="text" required />
			</div>
			<div>
				<label class="field-label" for="type">Type</label>
				<select class="field-input" id="type" name="type">
					<option value="weapon">Weapon</option>
					<option value="equipment">Equipment</option>
					<option value="consumable">Consumable</option>
					<option value="misc">Misc</option>
				</select>
			</div>
			<div class="sm:col-span-2">
				<label class="field-label" for="description">Description</label>
				<textarea class="field-input min-h-20" id="description" name="description"></textarea>
			</div>
			<div>
				<label class="field-label" for="equipSlot">Equip slot</label>
				<input class="field-input" id="equipSlot" name="equipSlot" type="text" placeholder="mainHand" />
			</div>
			<div>
				<label class="field-label" for="damage">Damage / stats</label>
				<input class="field-input" id="damage" name="damage" type="text" placeholder="2d6" />
			</div>
			<div class="flex gap-2 sm:col-span-2">
				<button type="submit" class="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
				{#if editingId}
					<button type="button" class="btn btn-secondary" onclick={() => (editingId = null)}>Cancel</button>
				{/if}
			</div>
		</form>
	</div>

	<div class="space-y-3">
		<h2 class="text-lg font-semibold">Items ({data.items.length})</h2>
		{#if data.items.length === 0}
			<p class="text-neutral-600">No items yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each data.items as item}
					<li class="card flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="font-medium">{item.name}</p>
							<p class="text-sm text-neutral-500">{(item.data as { type?: string }).type ?? 'misc'}</p>
							{#if (item.data as { description?: string }).description}
								<p class="mt-1 text-sm">{(item.data as { description?: string }).description}</p>
							{/if}
						</div>
						<div class="flex gap-2">
							<button type="button" class="btn btn-secondary" onclick={() => (editingId = item.id)}>
								Edit
							</button>
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="itemId" value={item.id} />
								<button type="submit" class="btn btn-danger">Delete</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
