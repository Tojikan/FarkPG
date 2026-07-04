<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>GM Login · FarkPG</title></svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<div class="card">
		<h1 class="font-display text-xl font-bold">GM Login</h1>

		<form
			method="POST"
			class="mt-5 space-y-3"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<input
				class="field"
				type="email"
				name="email"
				placeholder="Email"
				autocomplete="email"
				value={form?.email ?? ''}
				required
			/>
			<input
				class="field"
				type="password"
				name="password"
				placeholder="Password"
				autocomplete="current-password"
				required
			/>
			{#if form?.message}
				<p class="text-sm text-danger">{form.message}</p>
			{/if}
			<button type="submit" class="btn-primary w-full" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>

	<p class="mt-6 text-center text-sm text-muted">
		Playing in a campaign? <a href="/join" class="text-accent hover:underline">Join with a code</a>
	</p>
</div>
