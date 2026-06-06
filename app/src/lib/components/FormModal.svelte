<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		open: boolean;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let { title, open, onclose, children, footer }: Props = $props();

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="modal-backdrop" role="presentation" onclick={handleBackdrop}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
			<header class="modal-header">
				<h2 id="form-modal-title">{title}</h2>
				<button type="button" class="modal-close" aria-label="Close" onclick={onclose}>×</button>
			</header>
			<div class="modal-body">
				{@render children()}
			</div>
			{#if footer}
				<footer class="modal-footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal {
		width: min(100%, 26rem);
		background: #1e2736;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
		color: #e8ecf1;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #2d3a4d;
	}

	.modal-header h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}

	.modal-close {
		background: none;
		border: none;
		color: #8899aa;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}

	.modal-body {
		padding: 1.25rem;
	}

	.modal-body :global(label) {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #8899aa;
	}

	.modal-body :global(input),
	.modal-body :global(select) {
		background: #0f141c;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.55rem 0.65rem;
		color: #e8ecf1;
		font-size: 0.875rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid #2d3a4d;
	}
</style>
