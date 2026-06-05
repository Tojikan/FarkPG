<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<section class="mx-auto max-w-md space-y-4 py-8">
	<h1 class="text-2xl font-bold">Log in</h1>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	<form method="POST" use:enhance class="card space-y-4">
		<div>
			<label class="field-label" for="email">Email</label>
			<input class="field-input" id="email" name="email" type="email" required autocomplete="email" />
		</div>
		<div>
			<label class="field-label" for="password">Password</label>
			<input
				class="field-input"
				id="password"
				name="password"
				type="password"
				required
				autocomplete="current-password"
			/>
		</div>
		<button type="submit" class="btn btn-primary w-full">Log in</button>
	</form>

	<p class="text-sm text-neutral-600">
		No account? <a href="/signup" class="underline">Sign up</a>
	</p>
</section>
