<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import { BUILD_CTX, saveBuild, type BuildStore } from '$lib/build/context';

	interface Step {
		id: 'attributes' | 'skills' | 'abilities';
		label: string;
		number: number;
	}

	interface Props {
		currentStep: 'attributes' | 'skills' | 'abilities';
		footer: Snippet;
		children: Snippet;
	}

	let { currentStep, footer, children }: Props = $props();

	const build = getContext<BuildStore>(BUILD_CTX);

	const steps: Step[] = [
		{ id: 'attributes', label: 'Attributes', number: 1 },
		{ id: 'skills', label: 'Skills', number: 2 },
		{ id: 'abilities', label: 'Abilities', number: 3 }
	];

	async function goToStep(stepId: Step['id']) {
		if (stepId === currentStep) return;
		await saveBuild(build);
		if (stepId === 'skills') {
			goto(`/characters/${build.characterId}/build/skills?category=body`);
			return;
		}
		goto(`/characters/${build.characterId}/build/${stepId}`);
	}
</script>

<div class="build-root">
	<header class="build-header">
		<div class="build-header-inner">
			<div class="build-brand">
				<p class="build-brand-title">FARKPG</p>
				<p class="build-brand-sub">Character Builder</p>
			</div>

			<nav class="build-stepper" aria-label="Build progress">
				{#each steps as step}
					<button
						type="button"
						class="build-step"
						class:build-step-active={currentStep === step.id}
						class:build-step-done={steps.findIndex((s) => s.id === currentStep) > steps.findIndex((s) => s.id === step.id)}
						aria-current={currentStep === step.id ? 'step' : undefined}
						onclick={() => goToStep(step.id)}
					>
						<span class="build-step-num">{step.number}</span>
						<span class="build-step-label">{step.label}</span>
					</button>
				{/each}
			</nav>
		</div>
	</header>

	<div class="build-body">
		<div class="build-content">
			{@render children()}
		</div>
	</div>

	<footer class="build-footer">
		<div class="build-footer-inner">
			{@render footer()}
		</div>
	</footer>
</div>

<style>
	@import '$lib/components/builder/build-steps.css';

	.build-root {
		--build-cream: #0a0e14;
		--build-navy: #1a2332;
		--build-gold: #c9a227;
		margin: 0;
		width: 100%;
		min-height: calc(100vh - 3.5rem);
		display: flex;
		flex-direction: column;
		background: var(--build-page-bg);
	}

	.build-header {
		background: var(--build-navy);
		color: white;
		padding: 1rem 1.5rem;
	}

	.build-header-inner {
		max-width: 72rem;
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
	}

	.build-brand-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--build-gold);
		letter-spacing: 0.08em;
		line-height: 1.1;
	}

	.build-brand-sub {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 0.15rem;
	}

	.build-stepper {
		display: flex;
		gap: 0.5rem;
	}

	.build-step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		font: inherit;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
	}

	.build-step:hover:not(.build-step-active) {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.75);
	}

	.build-step-active {
		background: rgba(255, 255, 255, 0.12);
		color: white;
		box-shadow: inset 0 -2px 0 var(--build-gold);
	}

	.build-step-done {
		color: rgba(255, 255, 255, 0.85);
	}

	.build-step-num {
		display: flex;
		height: 1.5rem;
		width: 1.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid currentColor;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.build-step-active .build-step-num {
		background: var(--build-gold);
		border-color: var(--build-gold);
		color: var(--build-navy);
	}

	.build-body {
		flex: 1;
		background: var(--build-page-bg);
		padding: 2rem 1.5rem 6rem;
	}

	.build-content {
		max-width: 72rem;
		margin: 0 auto;
	}

	.build-footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: #141b26;
		border-top: 1px solid #2d3a4d;
		padding: 1rem 1.5rem;
		z-index: 40;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
	}

	.build-footer-inner {
		max-width: 72rem;
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
