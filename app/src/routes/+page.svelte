<script lang="ts">
	let { data } = $props();
</script>

<section class="space-y-4 py-8">
	<h1 class="text-3xl font-bold">FarkPG Character Sheets</h1>
	<p class="max-w-2xl text-neutral-700">
		Create and save character sheets online. Join a campaign with an invite code and build your character.
	</p>
	<div class="flex flex-wrap gap-3">
		{#if data.session}
			<a href="/campaigns" class="btn btn-primary">Go to dashboard</a>
		{:else}
			<a href="/signup" class="btn btn-primary">Sign up</a>
			<a href="/login" class="btn btn-secondary">Log in</a>
		{/if}
	</div>
</section>
