<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<section class="mx-auto max-w-md space-y-4 py-8">
	<h1 class="text-2xl font-bold">Sign up</h1>

	{#if form?.error}
		<p class="alert-error">{form.error}</p>
	{/if}

	{#if form?.success}
		<p class="alert-success">{form.success}</p>
	{/if}

	<form method="POST" use:enhance class="card space-y-4">
		<div>
			<label class="field-label" for="displayName">Display name</label>
			<input class="field-input" id="displayName" name="displayName" type="text" autocomplete="name" />
		</div>
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
				minlength="6"
				autocomplete="new-password"
			/>
		</div>
		<button type="submit" class="btn btn-primary w-full">Create account</button>
	</form>

	<p class="text-sm text-neutral-600">
		Already have an account? <a href="/login" class="underline">Log in</a>
	</p>
</section>
