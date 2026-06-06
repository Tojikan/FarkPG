<script lang="ts">
	import { MAX_EQUIPMENT_SLOTS, MAX_INVENTORY_SLOTS } from '$lib/data/sheet';

	interface Props {
		equipmentSlotsMax: number;
		inventorySlotsMax: number;
		readonly?: boolean;
		onclose: () => void;
		onsave: (values: { equipmentSlotsMax: number; inventorySlotsMax: number }) => void;
	}

	let { equipmentSlotsMax, inventorySlotsMax, readonly = false, onclose, onsave }: Props = $props();

	let draftEquipment = $state(equipmentSlotsMax);
	let draftInventory = $state(inventorySlotsMax);

	function handleSave() {
		if (readonly) return;
		onsave({
			equipmentSlotsMax: Math.max(0, Math.floor(draftEquipment)),
			inventorySlotsMax: Math.max(0, Math.floor(draftInventory))
		});
		onclose();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="sheet-config-title">
		<header class="modal-header">
			<h2 id="sheet-config-title">Sheet settings</h2>
			<button type="button" class="modal-close" aria-label="Close" onclick={onclose}>×</button>
		</header>

		<div class="modal-body">
			<label class="field">
				<span>Equipment slots (max)</span>
				<input
					type="number"
					min="0"
					bind:value={draftEquipment}
					disabled={readonly}
					placeholder={String(MAX_EQUIPMENT_SLOTS)}
				/>
			</label>

			<label class="field">
				<span>Inventory slots (max)</span>
				<input
					type="number"
					min="0"
					bind:value={draftInventory}
					disabled={readonly}
					placeholder={String(MAX_INVENTORY_SLOTS)}
				/>
			</label>
		</div>

		<footer class="modal-footer">
			<div class="modal-footer-right">
				<button type="button" class="btn-secondary" onclick={onclose}>Cancel</button>
				{#if !readonly}
					<button type="button" class="btn-primary" onclick={handleSave}>Save</button>
				{/if}
			</div>
		</footer>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
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
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #8899aa;
	}

	.field input {
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.5rem 0.65rem;
		color: #e8ecf1;
		font-size: 0.875rem;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 1rem 1.25rem;
		border-top: 1px solid #2d3a4d;
	}

	.modal-footer-right {
		display: flex;
		gap: 0.5rem;
	}

	.btn-primary,
	.btn-secondary {
		border-radius: 0.375rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.btn-primary {
		background: #5dade2;
		color: #0d1117;
	}

	.btn-secondary {
		background: transparent;
		border-color: #3a4d66;
		color: #c5d0dc;
	}
</style>
