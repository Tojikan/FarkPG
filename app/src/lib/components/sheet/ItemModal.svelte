<script lang="ts">
	import {
		applyDefaultFieldValues,
		defaultFeaturesForKind,
		itemImagePublicUrl,
		ITEM_KINDS,
		normalizeInventoryEntry,
		sanitizeInventoryEntry
	} from '$lib/data/items';
	import { PORTRAIT_ACCEPT } from '$lib/data/portrait';
	import type { InventoryEntry, ItemKind } from '$lib/data/types';

	interface Props {
		entry: InventoryEntry;
		characterId: string;
		readonly?: boolean;
		showEquipButton?: boolean;
		onclose: () => void;
		onsave: (entry: InventoryEntry) => void;
		ondelete?: () => void;
	}

	let {
		entry,
		characterId,
		readonly = false,
		showEquipButton = false,
		onclose,
		onsave,
		ondelete
	}: Props = $props();

	let draft = $state(normalizeInventoryEntry(JSON.parse(JSON.stringify(entry)) as InventoryEntry));
	let imageInput = $state<HTMLInputElement | null>(null);
	let imageUploading = $state(false);
	let imageError = $state('');

	const imageUrl = $derived(
		draft.imagePath ? itemImagePublicUrl(draft.imagePath, draft.imageUpdatedAt) : null
	);

	const features = $derived(draft.features ?? defaultFeaturesForKind(draft.itemKind ?? 'equipment'));

	function setKind(kind: ItemKind) {
		if (readonly) return;
		draft = applyDefaultFieldValues({
			...draft,
			itemKind: kind,
			features: defaultFeaturesForKind(kind)
		});
	}

	function toggleFeature(key: keyof NonNullable<typeof draft.features>, checked: boolean) {
		if (readonly) return;
		const nextFeatures = { ...features, [key]: checked };
		draft = applyDefaultFieldValues({ ...draft, features: nextFeatures });
	}

	function handleSave() {
		if (readonly) return;
		onsave(sanitizeInventoryEntry(draft));
		onclose();
	}

	function handleEquip() {
		if (readonly) return;
		onsave(sanitizeInventoryEntry({ ...draft, equipped: true }));
		onclose();
	}

	function openImagePicker() {
		if (readonly || imageUploading) return;
		imageInput?.click();
	}

	async function handleImageSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || readonly) return;

		imageError = '';
		imageUploading = true;
		try {
			const body = new FormData();
			body.append('file', file);
			const res = await fetch(`/characters/${characterId}/items/${draft.itemId}/image`, {
				method: 'POST',
				body
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(payload.message ?? 'Upload failed');
			}
			draft = {
				...draft,
				imagePath: payload.imagePath,
				imageUpdatedAt: payload.imageUpdatedAt
			};
		} catch (err) {
			imageError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			imageUploading = false;
		}
	}

	async function removeImage() {
		if (readonly || imageUploading || !draft.imagePath) return;
		imageError = '';
		imageUploading = true;
		try {
			const res = await fetch(
				`/characters/${characterId}/items/${draft.itemId}/image?path=${encodeURIComponent(draft.imagePath)}`,
				{ method: 'DELETE' }
			);
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.message ?? 'Remove failed');
			}
			draft = { ...draft, imagePath: undefined, imageUpdatedAt: undefined };
		} catch (err) {
			imageError = err instanceof Error ? err.message : 'Remove failed';
		} finally {
			imageUploading = false;
		}
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
		<header class="modal-header">
			<h2 id="item-modal-title">{entry.label?.trim() ? 'Edit item' : 'Add item'}</h2>
			<button type="button" class="modal-close" aria-label="Close" onclick={onclose}>×</button>
		</header>

		<div class="modal-body">
			<div class="image-section">
				<button
					type="button"
					class="item-image-btn"
					class:item-image-uploading={imageUploading}
					disabled={readonly || imageUploading}
					onclick={openImagePicker}
					aria-label="Upload item image"
				>
					{#if imageUrl}
						<img src={imageUrl} alt="" class="item-image" />
					{:else}
						<i class="fa-solid fa-image item-image-placeholder" aria-hidden="true"></i>
					{/if}
					{#if !readonly}
						<span class="item-image-overlay"><i class="fa-solid fa-camera" aria-hidden="true"></i></span>
					{/if}
				</button>
				{#if !readonly && imageUrl}
					<button type="button" class="btn-link" disabled={imageUploading} onclick={removeImage}>
						Remove image
					</button>
				{/if}
				{#if imageError}
					<p class="field-error">{imageError}</p>
				{/if}
				<input
					bind:this={imageInput}
					type="file"
					class="hidden-input"
					accept={PORTRAIT_ACCEPT}
					onchange={handleImageSelected}
				/>
			</div>

			<label class="field">
				<span>Name</span>
				<input bind:value={draft.label} disabled={readonly} placeholder="Item name" />
			</label>

			<label class="field">
				<span>Type</span>
				<select
					value={draft.itemKind ?? 'equipment'}
					disabled={readonly}
					onchange={(e) => setKind(e.currentTarget.value as ItemKind)}
				>
					{#each ITEM_KINDS as kind}
						<option value={kind.id}>{kind.label}</option>
					{/each}
				</select>
			</label>

			<label class="field">
				<span>Description</span>
				<textarea bind:value={draft.description} disabled={readonly} rows="2" placeholder="Flavor text or bonus"></textarea>
			</label>

			<fieldset class="features-fieldset">
				<legend>Features</legend>
				<label class="checkbox-field">
					<input
						type="checkbox"
						checked={features.hasQuantity ?? false}
						disabled={readonly}
						onchange={(e) => toggleFeature('hasQuantity', e.currentTarget.checked)}
					/>
					<span>Has Quantity</span>
				</label>
				<label class="checkbox-field">
					<input
						type="checkbox"
						checked={features.hasDurability ?? false}
						disabled={readonly}
						onchange={(e) => toggleFeature('hasDurability', e.currentTarget.checked)}
					/>
					<span>Has Durability</span>
				</label>
				<label class="checkbox-field">
					<input
						type="checkbox"
						checked={features.hasAmmo ?? false}
						disabled={readonly}
						onchange={(e) => toggleFeature('hasAmmo', e.currentTarget.checked)}
					/>
					<span>Has Ammo</span>
				</label>
				<label class="checkbox-field">
					<input
						type="checkbox"
						checked={features.hasDamage ?? false}
						disabled={readonly}
						onchange={(e) => toggleFeature('hasDamage', e.currentTarget.checked)}
					/>
					<span>Has Damage</span>
				</label>
				<label class="checkbox-field">
					<input type="checkbox" bind:checked={draft.equipped} disabled={readonly} />
					<span>Equipped</span>
				</label>
			</fieldset>

			{#if features.hasQuantity}
				<label class="field">
					<span>Quantity</span>
					<input type="number" min="1" bind:value={draft.quantity} disabled={readonly} />
				</label>
			{/if}

			{#if features.hasDurability && draft.durability}
				<div class="pair-row">
					<label class="field">
						<span>Durability (current)</span>
						<input type="number" min="0" bind:value={draft.durability.current} disabled={readonly} />
					</label>
					<label class="field">
						<span>Durability (max)</span>
						<input type="number" min="1" bind:value={draft.durability.max} disabled={readonly} />
					</label>
				</div>
			{/if}

			{#if features.hasAmmo && draft.ammo}
				<div class="pair-row">
					<label class="field">
						<span>Ammo (current)</span>
						<input type="number" min="0" bind:value={draft.ammo.current} disabled={readonly} />
					</label>
					<label class="field">
						<span>Ammo (max)</span>
						<input type="number" min="1" bind:value={draft.ammo.max} disabled={readonly} />
					</label>
				</div>
			{/if}

			{#if features.hasDamage && draft.damage}
				<div class="pair-row">
					<label class="field">
						<span>Damage (base)</span>
						<input type="number" step="any" bind:value={draft.damage.base} disabled={readonly} />
					</label>
					<label class="field">
						<span>Additional damage</span>
						<input type="number" step="any" bind:value={draft.damage.additional} disabled={readonly} />
					</label>
				</div>
			{/if}
		</div>

		<footer class="modal-footer">
			{#if ondelete && !readonly}
				<button type="button" class="btn-danger" onclick={() => { ondelete(); onclose(); }}>Delete</button>
			{/if}
			<div class="modal-footer-right">
				{#if showEquipButton && !readonly}
					<button type="button" class="btn-equip" onclick={handleEquip}>Equip</button>
				{/if}
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
		width: min(100%, 32rem);
		max-height: min(92vh, 48rem);
		overflow-y: auto;
		background: #1e2736;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
		color: #e8ecf1;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
		scrollbar-width: thin;
		scrollbar-color: #3a4d66 #1a2332;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #2d3a4d;
		position: sticky;
		top: 0;
		background: #1e2736;
		z-index: 1;
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

	.image-section {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}

	.item-image-btn {
		width: 6rem;
		height: 6rem;
		border-radius: 0.375rem;
		border: 2px solid #3a4d66;
		background: #141b26;
		padding: 0;
		cursor: pointer;
		position: relative;
		overflow: hidden;
	}

	.item-image-btn:disabled {
		cursor: default;
		opacity: 0.85;
	}

	.item-image-uploading {
		opacity: 0.65;
	}

	.item-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.item-image-placeholder {
		font-size: 1.75rem;
		color: #5a6a7a;
	}

	.item-image-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.item-image-btn:hover .item-image-overlay,
	.item-image-btn:focus-visible .item-image-overlay {
		opacity: 1;
	}

	.hidden-input {
		display: none;
	}

	.field-error {
		color: #e74c3c;
		font-size: 0.72rem;
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #8899aa;
	}

	.field input,
	.field select,
	.field textarea {
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.5rem 0.65rem;
		color: #e8ecf1;
		font-size: 0.875rem;
	}

	.features-fieldset {
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.65rem 0.75rem;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem 0.75rem;
	}

	.features-fieldset legend {
		font-size: 0.75rem;
		color: #8899aa;
		padding: 0 0.25rem;
	}

	.checkbox-field {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: #c5d0dc;
	}

	.pair-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}

	.btn-link {
		background: none;
		border: none;
		color: #5dade2;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-top: 1px solid #2d3a4d;
		position: sticky;
		bottom: 0;
		background: #1e2736;
	}

	.modal-footer-right {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.btn-primary,
	.btn-secondary,
	.btn-danger,
	.btn-equip {
		border-radius: 0.375rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}

	.btn-primary {
		background: #c9a227;
		color: #1a2332;
	}

	.btn-secondary {
		background: #2d3a4d;
		color: #e8ecf1;
	}

	.btn-danger {
		background: #922b21;
		color: #fff;
	}

	.btn-equip {
		background: #2980b9;
		color: #fff;
	}
</style>
