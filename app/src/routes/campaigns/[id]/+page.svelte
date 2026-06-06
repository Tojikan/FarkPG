<script lang="ts">
	import { enhance } from '$app/forms';
	import FormModal from '$lib/components/FormModal.svelte';

	let { data, form } = $props();

	let showCreateModal = $state(false);
	let copiedCode = $state(false);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function campaignAccent(id: string): string {
		const hues = [250, 210, 280, 190, 330];
		const n = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
		return `hsl(${hues[n % hues.length]} 45% 35%)`;
	}

	function levelAccent(level: number): string {
		const hues = [270, 150, 210, 45, 330];
		return `hsl(${hues[level % hues.length]} 55% 45%)`;
	}

	async function copyInvite() {
		try {
			await navigator.clipboard.writeText(data.campaign.invite_code);
			copiedCode = true;
			setTimeout(() => (copiedCode = false), 1500);
		} catch {
			/* ignore */
		}
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function closeCreateOnSuccess() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			showCreateModal = false;
		};
	}
</script>

<div class="campaign-page">
	<header class="page-top">
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<a href="/campaigns">Dashboard</a>
			<span aria-hidden="true">/</span>
			<span class="current">{data.campaign.name}</span>
		</nav>

		<div class="page-top-actions">
			<a href="/campaigns" class="btn btn-ghost">
				<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
				Return to dashboard
			</a>
			{#if !data.isGm}
				<form
					method="POST"
					action="?/leave"
					use:enhance
					onsubmit={(e) =>
						!confirm('Leave this campaign? Your characters will remain assigned to it.') &&
						e.preventDefault()}
				>
					<button type="submit" class="btn btn-outline btn-sm">
						<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
						Leave campaign
					</button>
				</form>
			{/if}
		</div>
	</header>

	{#if form?.error}
		<p class="page-alert">{form.error}</p>
	{/if}

	<section class="campaign-hero card">
		<div class="campaign-art" style="background: linear-gradient(135deg, {campaignAccent(data.campaign.id)}, #141b26);">
			<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
		</div>
		<div class="campaign-hero-body">
			<div class="campaign-title-row">
				<h1>{data.campaign.name}</h1>
				{#if data.isGm}
					<span class="role-badge role-gm">
						<i class="fa-solid fa-crown" aria-hidden="true"></i>
						You are GM
					</span>
				{/if}
			</div>
			<p class="campaign-meta">
				<i class="fa-regular fa-calendar" aria-hidden="true"></i>
				Campaign created {formatDate(data.campaign.created_at)}
			</p>
			<div class="stat-row">
				<span><i class="fa-solid fa-users" aria-hidden="true"></i> {data.memberCount} Players</span>
				<span><i class="fa-solid fa-scroll" aria-hidden="true"></i> {data.characterCount} Characters</span>
			</div>
		</div>
	</section>

	{#if data.isGm}
		<section class="invite-card card">
			<div class="invite-copy">
				<i class="fa-solid fa-link" aria-hidden="true"></i>
				<div>
					<h2>Invite code</h2>
					<p>Share this code with players to let them join the campaign.</p>
				</div>
			</div>
			<div class="invite-code-wrap">
				<code class="invite-code">{data.campaign.invite_code}</code>
				<button type="button" class="btn btn-icon" aria-label="Copy invite code" onclick={copyInvite}>
					<i class="fa-regular fa-copy" aria-hidden="true"></i>
				</button>
				{#if copiedCode}
					<span class="copied-toast">Copied</span>
				{/if}
			</div>
		</section>
	{/if}

	<section class="characters-panel card">
		<div class="characters-header">
			<div>
				<h2>Campaign characters</h2>
				<p>All characters in this campaign. You can view any character; only owners and GMs can edit.</p>
			</div>
			<button type="button" class="btn btn-blue" onclick={() => (showCreateModal = true)}>
				<i class="fa-solid fa-plus" aria-hidden="true"></i>
				Create character
			</button>
		</div>

		{#if data.characters.length === 0}
			<p class="empty-text">No characters in this campaign yet.</p>
		{:else}
			<ul class="character-list">
				{#each data.characters as character (character.id)}
					<li class="character-row">
						<div class="character-main">
							<div class="character-portrait">
								{#if character.portrait_url}
									<img src={character.portrait_url} alt="" />
								{:else}
									<i class="fa-solid fa-user" aria-hidden="true"></i>
								{/if}
							</div>
							<div class="character-info">
								<div class="character-name-row">
									<span class="character-name">{character.name || 'Unnamed'}</span>
									<span class="level-badge" style="--level-color: {levelAccent(character.level)}">
										Level {character.level}
									</span>
								</div>
								<p class="character-meta">
									{character.theme_label}
									{#if !character.isOwner}
										<span class="meta-sep" aria-hidden="true">·</span>
										{character.owner_name}
									{:else}
										<span class="meta-sep" aria-hidden="true">·</span>
										<span class="meta-you">You</span>
									{/if}
								</p>
							</div>
						</div>
						<div class="character-actions">
							<a href="/characters/{character.id}" class="btn btn-outline btn-sm">
								{character.canEdit ? 'Open sheet' : 'View character'}
							</a>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.isGm}
		<section class="danger-zone card">
			<h2>Delete campaign</h2>
			<p>
				Removes this campaign and its item store. Characters stay on each player's dashboard but become
				unassigned.
			</p>
			<form
				method="POST"
				action="?/delete"
				use:enhance
				onsubmit={(e) =>
					!confirm(`Delete "${data.campaign.name}"? This cannot be undone.`) && e.preventDefault()}
			>
				<button type="submit" class="btn btn-danger">Delete campaign</button>
			</form>
		</section>
	{/if}
</div>

<FormModal open={showCreateModal} title="Create character" onclose={closeCreateModal}>
	<form method="POST" action="?/createCharacter" use:enhance={closeCreateOnSuccess} id="create-campaign-char-form">
		<label class="field">
			<span>Name</span>
			<input name="name" type="text" required placeholder="Character name" />
		</label>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-outline" onclick={closeCreateModal}>Cancel</button>
		<button type="submit" form="create-campaign-char-form" class="btn btn-blue">Create</button>
	{/snippet}
</FormModal>

<style>
	.campaign-page {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1.25rem 1rem 2.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.page-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		color: #8899aa;
	}

	.breadcrumbs a {
		color: #8899aa;
		text-decoration: none;
	}

	.breadcrumbs a:hover {
		color: #c5d0dc;
	}

	.breadcrumbs .current {
		color: #e8ecf1;
	}

	.page-top-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.page-alert {
		margin: 0;
		padding: 0.65rem 0.85rem;
		border-radius: 0.5rem;
		background: rgba(231, 76, 60, 0.12);
		border: 1px solid rgba(231, 76, 60, 0.35);
		color: #f5b7b1;
		font-size: 0.85rem;
	}

	.card {
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
	}

	.campaign-hero {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}

	@media (min-width: 640px) {
		.campaign-hero {
			grid-template-columns: 7rem 1fr;
			align-items: center;
		}
	}

	.campaign-art {
		width: 100%;
		aspect-ratio: 1;
		max-width: 7rem;
		border-radius: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: rgba(255, 255, 255, 0.85);
	}

	.campaign-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0.35rem;
	}

	.campaign-title-row h1 {
		margin: 0;
		font-size: 1.65rem;
		font-weight: 700;
		color: #fff;
	}

	.role-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.role-gm {
		background: rgba(142, 68, 173, 0.2);
		border: 1px solid rgba(187, 134, 252, 0.35);
		color: #bb86fc;
	}

	.campaign-meta {
		margin: 0 0 0.75rem;
		font-size: 0.82rem;
		color: #8899aa;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.stat-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.82rem;
		color: #c5d0dc;
	}

	.stat-row i {
		color: #8899aa;
		margin-right: 0.25rem;
	}

	.invite-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}

	.invite-copy {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		min-width: 0;
	}

	.invite-copy > i {
		margin-top: 0.15rem;
		color: #8899aa;
	}

	.invite-copy h2 {
		margin: 0 0 0.2rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: #e8ecf1;
	}

	.invite-copy p {
		margin: 0;
		font-size: 0.8rem;
		color: #8899aa;
		line-height: 1.4;
	}

	.invite-code-wrap {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		position: relative;
	}

	.invite-code {
		font-family: ui-monospace, monospace;
		font-size: 0.95rem;
		padding: 0.45rem 0.75rem;
		border-radius: 0.375rem;
		background: #0a0e14;
		border: 1px solid #2d3a4d;
		color: #e8ecf1;
		letter-spacing: 0.06em;
	}

	.copied-toast {
		position: absolute;
		right: 0;
		top: calc(100% + 0.25rem);
		font-size: 0.7rem;
		color: #27ae60;
	}

	.characters-panel {
		padding: 1.25rem;
	}

	.characters-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.characters-header h2 {
		margin: 0 0 0.25rem;
		font-size: 1.05rem;
		font-weight: 600;
		color: #fff;
	}

	.characters-header p {
		margin: 0;
		font-size: 0.8rem;
		color: #8899aa;
		line-height: 1.45;
		max-width: 32rem;
	}

	.empty-text {
		margin: 0;
		font-size: 0.85rem;
		color: #8899aa;
	}

	.character-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.character-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border: 1px solid #2d3a4d;
		border-radius: 0.65rem;
		background: #1a2332;
	}

	.character-main {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
		flex: 1 1 14rem;
	}

	.character-portrait {
		width: 3rem;
		height: 3rem;
		border-radius: 9999px;
		overflow: hidden;
		background: #243044;
		border: 1px solid #2d3a4d;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #8899aa;
		flex-shrink: 0;
	}

	.character-portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.character-name-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.15rem;
	}

	.character-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: #e8ecf1;
	}

	.level-badge {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--level-color) 18%, transparent);
		border: 1px solid color-mix(in srgb, var(--level-color) 45%, transparent);
		color: var(--level-color);
	}

	.character-meta {
		margin: 0;
		font-size: 0.78rem;
		color: #8899aa;
	}

	.meta-sep {
		margin: 0 0.2rem;
	}

	.meta-you {
		color: #5dade2;
	}

	.character-actions {
		flex-shrink: 0;
	}

	.danger-zone {
		padding: 1rem 1.25rem;
		border-color: rgba(231, 76, 60, 0.25);
	}

	.danger-zone h2 {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		color: #e74c3c;
	}

	.danger-zone p {
		margin: 0 0 0.75rem;
		font-size: 0.78rem;
		color: #8899aa;
		line-height: 1.45;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border: none;
		border-radius: 0.375rem;
		padding: 0.5rem 0.85rem;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.btn:hover {
		opacity: 0.92;
	}

	.btn-blue {
		background: linear-gradient(135deg, #2980b9, #1f618d);
		color: #fff;
	}

	.btn-outline {
		background: transparent;
		border: 1px solid #3a4d66;
		color: #c5d0dc;
	}

	.btn-ghost {
		background: transparent;
		color: #8899aa;
	}

	.btn-sm {
		padding: 0.4rem 0.7rem;
		font-size: 0.78rem;
	}

	.btn-icon {
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		background: #1a2332;
		border: 1px solid #2d3a4d;
		color: #c5d0dc;
	}

	.btn-danger {
		background: #922b21;
		color: #fff;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #8899aa;
	}

	.field input {
		background: #0a0e14;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.55rem 0.65rem;
		color: #e8ecf1;
		font-size: 0.875rem;
	}
</style>
