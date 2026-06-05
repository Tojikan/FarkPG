<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<section class="space-y-6 py-8">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<p class="text-sm text-neutral-500"><a href="/campaigns" class="underline">Campaigns</a></p>
			<h1 class="text-2xl font-bold">{data.campaign.name}</h1>
			{#if data.isGm}
				<p class="mt-2 text-sm text-neutral-600">
					Invite code: <code class="rounded bg-neutral-100 px-2 py-1">{data.campaign.invite_code}</code>
				</p>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<a href="/campaigns/{data.campaign.id}/characters" class="btn btn-primary">Characters</a>
			{#if data.isGm}
				<a href="/campaigns/{data.campaign.id}/gm/items" class="btn btn-secondary">Item store</a>
				<a href="/campaigns/{data.campaign.id}/gm/grant" class="btn btn-secondary">Grant items</a>
			{/if}
		</div>
	</div>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	<div class="card">
		<h2 class="mb-3 text-lg font-semibold">Members ({data.members.length})</h2>
		<ul class="space-y-2">
			{#each data.members as member}
				<li class="flex items-center justify-between border-b border-neutral-100 py-2 last:border-0">
					<span>{member.display_name ?? 'Unknown'}</span>
					<span class="text-sm uppercase text-neutral-500">{member.role}</span>
				</li>
			{/each}
		</ul>
	</div>

	{#if data.isGm}
		<div class="card border-red-200">
			<h2 class="mb-2 text-lg font-semibold text-red-900">Danger zone</h2>
			<p class="mb-4 text-sm text-neutral-600">
				Delete this campaign, its item store, and member links. Characters in this campaign will become
				unassigned and remain on each player's dashboard.
			</p>
			<form
				method="POST"
				action="?/delete"
				use:enhance
				onsubmit={(e) =>
					!confirm(
						`Delete "${data.campaign.name}"? Characters will be kept but unassigned from this campaign. Items will be deleted.`
					) && e.preventDefault()}
			>
				<button type="submit" class="btn btn-danger">Delete campaign</button>
			</form>
		</div>
	{/if}
</section>
