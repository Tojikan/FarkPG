<script lang="ts">
	interface Props {
		dieId: string;
		value: number;
		selected: boolean;
		rolling: boolean;
		draggable: boolean;
		size?: 'lg' | 'sm';
		onSelect: (e: MouseEvent) => void;
		onDragStart: (e: DragEvent) => void;
	}

	let { dieId, value, selected, rolling, draggable, size = 'lg', onSelect, onDragStart }: Props =
		$props();

	/** Percent-based pip centers on a 0-100 face, standard d6 layout. */
	const PIP_LAYOUTS: Record<number, [number, number][]> = {
		1: [[50, 50]],
		2: [
			[28, 28],
			[72, 72]
		],
		3: [
			[28, 28],
			[50, 50],
			[72, 72]
		],
		4: [
			[28, 28],
			[72, 28],
			[28, 72],
			[72, 72]
		],
		5: [
			[28, 28],
			[72, 28],
			[50, 50],
			[28, 72],
			[72, 72]
		],
		6: [
			[28, 22],
			[72, 22],
			[28, 50],
			[72, 50],
			[28, 78],
			[72, 78]
		]
	};

	const pips = $derived(PIP_LAYOUTS[Math.min(6, Math.max(1, Math.floor(value) || 1))] ?? []);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(e as unknown as MouseEvent);
		}
	}
</script>

<div
	class="die die-{size}"
	class:selected
	class:rolling
	data-die-id={dieId}
	draggable={draggable}
	role="button"
	tabindex="0"
	aria-pressed={selected}
	aria-label={`Die showing ${value}${selected ? ', selected' : ''}`}
	onclick={onSelect}
	onkeydown={onKeydown}
	ondragstart={onDragStart}
>
	<svg viewBox="0 0 100 100" class="die-face" aria-hidden="true">
		{#each pips as [cx, cy] (cx + '-' + cy)}
			<circle {cx} {cy} r="7.5" />
		{/each}
	</svg>
</div>

<style>
	.die {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.55rem;
		border: 2px solid var(--app-edge-strong);
		background: linear-gradient(145deg, var(--app-raised), var(--app-bg));
		box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.35);
		cursor: pointer;
		user-select: none;
		touch-action: none;
		flex-shrink: 0;
	}

	.die-lg {
		width: 3.25rem;
		height: 3.25rem;
	}

	.die-sm {
		width: 1.9rem;
		height: 1.9rem;
		border-width: 1px;
		border-radius: 0.4rem;
	}

	.die[draggable='true'] {
		cursor: grab;
	}

	.die[draggable='true']:active {
		cursor: grabbing;
	}

	.die.selected {
		border-color: var(--app-accent);
		outline: 3px solid var(--app-accent);
		outline-offset: 1px;
	}

	.die-sm.selected {
		outline-width: 2px;
	}

	.die-face {
		width: 80%;
		height: 80%;
		fill: var(--app-ink);
	}

	.die:focus-visible {
		outline: 3px solid var(--app-accent);
		outline-offset: 2px;
	}

	@keyframes dice-roller-shake {
		0% {
			transform: rotate(0deg) scale(1);
		}
		18% {
			transform: rotate(-16deg) scale(1.08);
		}
		36% {
			transform: rotate(14deg) scale(1.1);
		}
		54% {
			transform: rotate(-11deg) scale(1.06);
		}
		72% {
			transform: rotate(7deg) scale(1.03);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}

	@keyframes dice-roller-pulse {
		0%,
		100% {
			opacity: 1;
			filter: brightness(1);
		}
		50% {
			opacity: 0.8;
			filter: brightness(1.4);
		}
	}

	.die.rolling {
		animation: dice-roller-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		z-index: 2;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.die.rolling {
			animation: dice-roller-pulse 0.32s ease-out both;
		}
	}
</style>
