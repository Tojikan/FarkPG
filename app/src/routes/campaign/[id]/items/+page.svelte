<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let nameInput = $state<HTMLInputElement | null>(null);
	let quickAddForm = $state<HTMLFormElement | null>(null);
	let editingId = $state<string | null>(null);

	$effect(() => {
		nameInput?.focus();
	});

	function fieldValue(item: { data: Record<string, string | number> }, fieldId: string) {
		return item.data?.[fieldId] ?? '';
	}
</script>

<svelte:head><title>Items · {data.campaign.name} · FarkPG</title></svelte:head>

<div data-setting={data.campaign.setting_id}>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<a href="/campaign/{data.campaign.id}" class="text-sm text-muted hover:text-accent">
				← {data.campaign.name}
			</a>
			<h1 class="font-display text-2xl font-bold">Item generator</h1>
		</div>
		{#if data.setting.itemTemplates.length > 0}
			<form method="POST" action="?/seedTemplates" use:enhance>
				<button type="submit" class="btn-ghost text-sm">Add {data.setting.name} starter items</button>
			</form>
		{/if}
	</div>

	<p class="mt-1 text-sm text-muted">
		Tab moves between fields, Enter saves and starts the next item.
	</p>

	<!-- Quick add: always focused, Enter commits and refocuses name -->
	<form
		bind:this={quickAddForm}
		method="POST"
		action="?/create"
		class="card mt-4"
		use:enhance={() => {
			return async ({ update, result }) => {
				await update({ reset: result.type === 'success' });
				nameInput?.focus();
			};
		}}
	>
		<div class="grid gap-2" style="grid-template-columns: 1.2fr 2fr repeat({data.setting.itemFields.length}, 0.7fr) auto;">
			<input
				bind:this={nameInput}
				class="field"
				name="name"
				placeholder="Item name"
				autocomplete="off"
				required
			/>
			<input class="field" name="description" placeholder="Description" autocomplete="off" />
			{#each data.setting.itemFields as field (field.id)}
				<input
					class="field"
					name="field_{field.id}"
					placeholder={field.name}
					type={field.type === 'number' ? 'number' : 'text'}
					autocomplete="off"
				/>
			{/each}
			<button type="submit" class="btn-primary">Add</button>
		</div>
		{#if form?.message}<p class="mt-2 text-sm text-danger">{form.message}</p>{/if}
	</form>

	<h2 class="mt-6 font-display text-lg font-bold">Campaign items ({data.items.length})</h2>
	{#if data.items.length === 0}
		<div class="card mt-3 text-center text-muted">No items yet — add some above.</div>
	{:else}
		<ul class="mt-3 space-y-2">
			{#each data.items as item (item.id)}
				<li class="card py-3">
					{#if editingId === item.id}
						<form
							method="POST"
							action="?/update"
							use:enhance={() => {
								return async ({ update }) => {
									editingId = null;
									await update();
								};
							}}
						>
							<input type="hidden" name="item_id" value={item.id} />
							<div class="grid gap-2" style="grid-template-columns: 1.2fr 2fr repeat({data.setting.itemFields.length}, 0.7fr) auto auto;">
								<input class="field" name="name" value={item.name} required />
								<input class="field" name="description" value={item.description} />
								{#each data.setting.itemFields as field (field.id)}
									<input
										class="field"
										name="field_{field.id}"
										value={fieldValue(item, field.id)}
										placeholder={field.name}
										type={field.type === 'number' ? 'number' : 'text'}
									/>
								{/each}
								<button type="submit" class="btn-primary px-3">Save</button>
								<button type="button" class="btn-ghost px-3" onclick={() => (editingId = null)}>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<div class="flex flex-wrap items-center gap-3">
							<span class="font-semibold">{item.name}</span>
							{#if item.description}<span class="flex-1 text-sm text-muted">{item.description}</span>{/if}
							{#each data.setting.itemFields as field (field.id)}
								{#if fieldValue(item, field.id) !== ''}
									<span class="rounded bg-raised px-2 py-0.5 text-xs text-muted">
										{field.name}: <span class="text-ink">{fieldValue(item, field.id)}</span>
									</span>
								{/if}
							{/each}
							<span class="ml-auto flex gap-1">
								<button class="btn-ghost px-3 py-1 text-xs" onclick={() => (editingId = item.id)}>
									Edit
								</button>
								<form method="POST" action="?/delete" use:enhance>
									<input type="hidden" name="item_id" value={item.id} />
									<button type="submit" class="btn px-3 py-1 text-xs text-danger hover:bg-danger/10">
										Delete
									</button>
								</form>
							</span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
