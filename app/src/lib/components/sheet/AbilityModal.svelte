<script lang="ts">
	import { PORTRAIT_ACCEPT } from '$lib/data/portrait';
	import { abilityImagePublicUrl } from '$lib/data/sheet';

	interface AbilityDraft {
		id: string;
		label: string;
		description: string;
		imagePath?: string;
		imageUpdatedAt?: string;
	}

	interface Props {
		ability: AbilityDraft;
		characterId: string;
		readonly?: boolean;
		onclose: () => void;
		onsave: (ability: AbilityDraft) => void;
		ondelete?: () => void;
	}

	let { ability, characterId, readonly = false, onclose, onsave, ondelete }: Props = $props();

	let draft = $state(JSON.parse(JSON.stringify(ability)) as AbilityDraft);
	let imageInput = $state<HTMLInputElement | null>(null);
	let imageUploading = $state(false);
	let imageError = $state('');

	const imageUrl = $derived(
		draft.imagePath ? abilityImagePublicUrl(draft.imagePath, draft.imageUpdatedAt) : null
	);

	function handleSave() {
		if (readonly) return;
		onsave({
			...draft,
			label: draft.label.trim() || 'Unnamed ability',
			description: draft.description.trim()
		});
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
			const res = await fetch(`/characters/${characterId}/abilities/${draft.id}/image`, {
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
				`/characters/${characterId}/abilities/${draft.id}/image?path=${encodeURIComponent(draft.imagePath)}`,
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
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ability-modal-title">
		<header class="modal-header">
			<h2 id="ability-modal-title">{ability.label?.trim() ? 'Edit ability' : 'Add ability'}</h2>
			<button type="button" class="modal-close" aria-label="Close" onclick={onclose}>×</button>
		</header>

		<div class="modal-body">
			<div class="image-section">
				<button
					type="button"
					class="ability-image-btn"
					class:ability-image-uploading={imageUploading}
					disabled={readonly || imageUploading}
					onclick={openImagePicker}
					aria-label="Upload ability image"
				>
					{#if imageUrl}
						<img src={imageUrl} alt="" class="ability-image" />
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles ability-image-placeholder" aria-hidden="true"></i>
					{/if}
					{#if !readonly}
						<span class="ability-image-overlay"><i class="fa-solid fa-camera" aria-hidden="true"></i></span>
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
				<input bind:value={draft.label} disabled={readonly} placeholder="Ability name" />
			</label>

			<label class="field">
				<span>Description</span>
				<textarea bind:value={draft.description} disabled={readonly} rows="5" placeholder="What does this ability do?"></textarea>
			</label>
		</div>

		<footer class="modal-footer">
			{#if ondelete && !readonly}
				<button type="button" class="btn-danger" onclick={() => { ondelete(); onclose(); }}>Delete</button>
			{/if}
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
		width: min(100%, 28rem);
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

	.image-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.ability-image-btn {
		position: relative;
		width: 6rem;
		height: 6rem;
		border: 1px dashed #3a4d66;
		border-radius: 0.75rem;
		background: #141b26;
		cursor: pointer;
		overflow: hidden;
		padding: 0;
	}

	.ability-image-btn:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.ability-image-uploading {
		opacity: 0.6;
	}

	.ability-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.ability-image-placeholder {
		font-size: 1.75rem;
		color: #5a6a7d;
	}

	.ability-image-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		color: #e8ecf1;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.ability-image-btn:hover .ability-image-overlay,
	.ability-image-btn:focus-visible .ability-image-overlay {
		opacity: 1;
	}

	.hidden-input {
		display: none;
	}

	.btn-link {
		background: none;
		border: none;
		color: #8899aa;
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.field-error {
		font-size: 0.75rem;
		color: #e74c3c;
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
	.field textarea {
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
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-top: 1px solid #2d3a4d;
	}

	.modal-footer-right {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	.btn-primary,
	.btn-secondary,
	.btn-danger {
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
</style>
