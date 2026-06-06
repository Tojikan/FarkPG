<script lang="ts">
	import { enhance } from '$app/forms';
	import FormModal from '$lib/components/FormModal.svelte';

	let { data, form } = $props();

	type ModalKind = 'createCampaign' | 'joinCampaign' | 'newCharacter' | 'assignCharacter' | null;
	let activeModal = $state<ModalKind>(null);
	let assignCharacterId = $state<string | null>(null);
	let openMenuId = $state<string | null>(null);
	let copiedCode = $state<string | null>(null);

	const assignCharacter = $derived(
		assignCharacterId ? data.characters.find((c) => c.id === assignCharacterId) : null
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function campaignAccent(id: string): string {
		const hues = [250, 210, 280, 190, 330];
		const n = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
		return `hsl(${hues[n % hues.length]} 45% 35%)`;
	}

	async function copyInvite(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			copiedCode = code;
			setTimeout(() => {
				if (copiedCode === code) copiedCode = null;
			}, 1500);
		} catch {
			/* ignore */
		}
	}

	function toggleMenu(id: string, e: MouseEvent) {
		e.stopPropagation();
		openMenuId = openMenuId === id ? null : id;
	}

	function closeMenus(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('.menu-wrap')) return;
		openMenuId = null;
	}

	function openModal(kind: ModalKind) {
		activeModal = kind;
	}

	function closeModal() {
		activeModal = null;
		assignCharacterId = null;
	}

	function openAssignModal(characterId: string) {
		assignCharacterId = characterId;
		activeModal = 'assignCharacter';
		openMenuId = null;
	}

	function closeMenuOnSuccess() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			openMenuId = null;
			closeModal();
		};
	}
</script>

<svelte:window onclick={closeMenus} />

<div class="dashboard">
	<section class="hero">
		<div class="hero-bg" aria-hidden="true"></div>
		<div class="hero-inner">
			<div class="hero-copy">
				<h1>Welcome back, <span>{data.displayName}</span></h1>
				<p>Manage your characters and campaigns.</p>
			</div>

			<div class="hero-actions">
				<div class="hero-card hero-card-create">
					<div class="hero-card-icon"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></div>
					<div class="hero-card-body">
						<h2>Create Campaign</h2>
						<p>Start a new adventure and invite your party.</p>
						<button type="button" class="btn btn-purple" onclick={() => openModal('createCampaign')}>
							Create Campaign
						</button>
					</div>
				</div>

				<div class="hero-card hero-card-join">
					<div class="hero-card-icon"><i class="fa-solid fa-users" aria-hidden="true"></i></div>
					<div class="hero-card-body">
						<h2>Join Campaign</h2>
						<p>Enter an invite code from your GM.</p>
						<button type="button" class="btn btn-blue" onclick={() => openModal('joinCampaign')}>
							Join Campaign
						</button>
					</div>
				</div>
			</div>
		</div>
	</section>

	{#if form?.error}
		<p class="alert-error dashboard-alert">{form.error}</p>
	{/if}

	<section class="panel">
		<div class="panel-header">
			<div class="panel-title">
				<i class="fa-solid fa-user-group" aria-hidden="true"></i>
				<h2>Your Characters</h2>
				<span class="count-badge">{data.characters.length}</span>
			</div>
			<button type="button" class="btn btn-outline" onclick={() => openModal('newCharacter')}>
				<i class="fa-solid fa-plus" aria-hidden="true"></i> New Character
			</button>
		</div>

		{#if data.characters.length === 0}
			<p class="empty-text">No characters yet. Create one to get started.</p>
		{:else}
			<table class="char-table">
				<colgroup>
					<col class="col-character" />
					<col class="col-campaign" />
					<col class="col-actions" />
				</colgroup>
				<thead>
					<tr>
						<th scope="col">Character</th>
						<th scope="col">Campaign</th>
						<th scope="col" class="col-actions-head">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.characters as character, index (character.id)}
						<tr class="char-row">
							<td class="char-cell-main">
								<div class="char-main">
									<div class="char-portrait">
										{#if character.portrait_url}
											<img src={character.portrait_url} alt="" />
										{:else}
											<i class="fa-solid fa-user" aria-hidden="true"></i>
										{/if}
									</div>
									<div>
										<div class="char-name-row">
											<a href="/characters/{character.id}" class="char-name">{character.name || 'Unnamed'}</a>
										</div>
										<p class="char-meta">Level {character.level} · {character.theme_label}</p>
									</div>
								</div>
							</td>

							<td class="char-campaign">
								<div class="char-campaign-inner">
									{#if character.campaign_name}
										<span>{character.campaign_name}</span>
									{:else}
										<span class="muted">Not in a campaign</span>
									{/if}
								</div>
							</td>

							<td class="char-actions">
								<div class="char-actions-inner">
									<a href="/characters/{character.id}" class="btn btn-outline btn-sm">Open Sheet</a>
									<div class="menu-wrap">
										<button
											type="button"
											class="btn btn-icon"
											aria-label="More actions"
											aria-expanded={openMenuId === character.id}
											onclick={(e) => toggleMenu(character.id, e)}
										>⋯</button>
										{#if openMenuId === character.id}
											<div
												class="dropdown"
												class:dropdown-up={index === data.characters.length - 1}
												role="menu"
												onclick={(e) => e.stopPropagation()}
											>
												{#if !character.campaign_id && data.campaigns.length > 0}
													<button
														type="button"
														class="dropdown-item"
														onclick={() => openAssignModal(character.id)}
													>
														Add to Campaign
													</button>
												{/if}
												{#if character.campaign_id}
													<form
														method="POST"
														action="?/unassignCharacter"
														use:enhance={() => closeMenuOnSuccess()}
													>
														<input type="hidden" name="characterId" value={character.id} />
														<button type="submit" class="dropdown-item">Remove from Campaign</button>
													</form>
												{/if}
												<form
													method="POST"
													action="?/deleteCharacter"
													use:enhance={() => closeMenuOnSuccess()}
													onsubmit={(e) => !confirm('Delete this character?') && e.preventDefault()}
												>
													<input type="hidden" name="characterId" value={character.id} />
													<button type="submit" class="dropdown-item dropdown-danger">Delete Character</button>
												</form>
											</div>
										{/if}
									</div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="panel">
		<div class="panel-header">
			<div class="panel-title">
				<i class="fa-solid fa-flag" aria-hidden="true"></i>
				<h2>Your Campaigns</h2>
				<span class="count-badge">{data.campaigns.length}</span>
			</div>
			<button type="button" class="btn btn-outline" onclick={() => openModal('createCampaign')}>
				<i class="fa-solid fa-plus" aria-hidden="true"></i> New Campaign
			</button>
		</div>

		{#if data.campaigns.length === 0}
			<p class="empty-text">No campaigns yet. Create one or join with an invite code.</p>
		{:else}
			<div class="campaign-grid">
				{#each data.campaigns as campaign (campaign.id)}
					<article class="campaign-card">
						<div class="campaign-art" style="background: linear-gradient(135deg, {campaignAccent(campaign.id)}, #141b26);">
							<i class="fa-solid fa-chess-rook" aria-hidden="true"></i>
						</div>
						<div class="campaign-body">
							<div class="campaign-top">
								<div class="campaign-title-row">
									<h3>{campaign.name}</h3>
									{#if campaign.role === 'gm'}
										<span class="badge badge-gm">GM</span>
									{/if}
								</div>
								{#if campaign.role === 'gm'}
									<button
										type="button"
										class="invite-chip"
										onclick={() => copyInvite(campaign.invite_code)}
										title="Copy invite code"
									>
										{campaign.invite_code}
										<i class="fa-regular fa-copy" aria-hidden="true"></i>
									</button>
									{#if copiedCode === campaign.invite_code}
										<span class="copied-toast">Copied!</span>
									{/if}
								{/if}
							</div>

							<p class="campaign-desc">
								{#if campaign.role === 'gm'}
									You are running this campaign. Share the invite code with your players.
								{:else}
									You are a player in this campaign.
								{/if}
							</p>

							<div class="campaign-stats">
								<span><i class="fa-solid fa-users" aria-hidden="true"></i> {campaign.member_count} Players</span>
								<span><i class="fa-solid fa-scroll" aria-hidden="true"></i> {campaign.character_count} Characters</span>
								<span><i class="fa-regular fa-calendar" aria-hidden="true"></i> {formatDate(campaign.created_at)}</span>
							</div>

							{#if campaign.my_characters.length > 0}
								<div class="campaign-chars">
									<span class="campaign-chars-label">Your Characters</span>
									<div class="campaign-char-list">
										{#each campaign.my_characters as ch}
											<a href="/characters/{ch.id}" class="campaign-char-thumb" title={ch.name}>
												{#if ch.portrait_url}
													<img src={ch.portrait_url} alt="" />
												{:else}
													<i class="fa-solid fa-user" aria-hidden="true"></i>
												{/if}
											</a>
										{/each}
									</div>
								</div>
							{/if}

							<div class="campaign-footer">
								<a href="/campaigns/{campaign.id}" class="btn btn-outline">Open Campaign</a>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<footer class="tip-bar">
		<i class="fa-regular fa-lightbulb" aria-hidden="true"></i>
		<p>Tip: Add your characters to a campaign to track their progress and share with your group.</p>
	</footer>
</div>

<FormModal title="Create Campaign" open={activeModal === 'createCampaign'} onclose={closeModal}>
	<form method="POST" action="?/create" use:enhance={() => closeMenuOnSuccess()} id="create-campaign-form">
		<label>
			<span>Campaign name</span>
			<input name="name" type="text" required placeholder="Reclaim the North" />
		</label>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={closeModal}>Cancel</button>
		<button type="submit" form="create-campaign-form" class="btn btn-purple">Create</button>
	{/snippet}
</FormModal>

<FormModal title="Join Campaign" open={activeModal === 'joinCampaign'} onclose={closeModal}>
	<form method="POST" action="?/join" use:enhance={() => closeMenuOnSuccess()} id="join-campaign-form">
		<label>
			<span>Invite code</span>
			<input name="inviteCode" type="text" required placeholder="abcd1234" />
		</label>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={closeModal}>Cancel</button>
		<button type="submit" form="join-campaign-form" class="btn btn-blue">Join</button>
	{/snippet}
</FormModal>

<FormModal title="New Character" open={activeModal === 'newCharacter'} onclose={closeModal}>
	<form method="POST" action="?/createCharacter" use:enhance={() => closeMenuOnSuccess()} id="new-character-form">
		<label>
			<span>Character name</span>
			<input name="name" type="text" required placeholder="Character name" />
		</label>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={closeModal}>Cancel</button>
		<button type="submit" form="new-character-form" class="btn btn-purple">Create</button>
	{/snippet}
</FormModal>

<FormModal
	title="Add to Campaign"
	open={activeModal === 'assignCharacter' && assignCharacter != null}
	onclose={closeModal}
>
	{#if assignCharacter}
		<form method="POST" action="?/assignCharacter" use:enhance={() => closeMenuOnSuccess()} id="assign-character-form">
			<input type="hidden" name="characterId" value={assignCharacter.id} />
			<label>
				<span>Assign <strong>{assignCharacter.name || 'Unnamed'}</strong> to</span>
				<select name="campaignId" required>
					<option value="" disabled selected>Select a campaign</option>
					{#each data.campaigns as campaign (campaign.id)}
						<option value={campaign.id}>{campaign.name}</option>
					{/each}
				</select>
			</label>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={closeModal}>Cancel</button>
		<button type="submit" form="assign-character-form" class="btn btn-purple">Add to Campaign</button>
	{/snippet}
</FormModal>

<style>
	.dashboard {
		color: #e8ecf1;
		padding-bottom: 2rem;
	}

	.hero {
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid #1e2736;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, rgba(10, 14, 20, 0.92) 0%, rgba(10, 14, 20, 0.55) 55%, rgba(10, 14, 20, 0.85) 100%),
			radial-gradient(circle at 70% 30%, rgba(88, 62, 156, 0.35), transparent 55%),
			linear-gradient(180deg, #141b26 0%, #0a0e14 100%);
	}

	.hero-inner {
		position: relative;
		max-width: 80rem;
		margin: 0 auto;
		padding: 2rem 1rem 1.75rem;
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 960px) {
		.hero-inner {
			grid-template-columns: 1fr 1.2fr;
			align-items: center;
			padding: 2.5rem 1.5rem 2rem;
		}
	}

	.hero-copy h1 {
		font-size: clamp(1.75rem, 4vw, 2.35rem);
		font-weight: 700;
		line-height: 1.15;
		margin: 0 0 0.5rem;
	}

	.hero-copy h1 span {
		color: #c9a227;
	}

	.hero-copy p {
		margin: 0;
		color: #8899aa;
		font-size: 0.95rem;
	}

	.hero-actions {
		display: grid;
		gap: 0.85rem;
	}

	@media (min-width: 640px) {
		.hero-actions {
			grid-template-columns: 1fr 1fr;
		}
	}

	.hero-card {
		display: flex;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid #2d3a4d;
		background: rgba(20, 27, 38, 0.85);
		backdrop-filter: blur(4px);
	}

	.hero-card-icon {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.hero-card-create .hero-card-icon {
		background: rgba(142, 68, 173, 0.25);
		color: #bb86fc;
	}

	.hero-card-join .hero-card-icon {
		background: rgba(41, 128, 185, 0.25);
		color: #5dade2;
	}

	.hero-card-body h2 {
		margin: 0 0 0.25rem;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.hero-card-body p {
		margin: 0 0 0.75rem;
		font-size: 0.78rem;
		color: #8899aa;
		line-height: 1.4;
	}

	.inline-form-panel {
		max-width: 80rem;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
		padding: 1rem;
		margin-top: 1rem;
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
	}

	.inline-form label {
		flex: 1 1 14rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #8899aa;
	}

	.inline-form input {
		background: #0a0e14;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.55rem 0.65rem;
		color: #e8ecf1;
	}

	.inline-form-actions {
		display: flex;
		gap: 0.5rem;
	}

	.dashboard-alert {
		max-width: 80rem;
		margin: 1rem auto 0;
		padding: 0 1rem;
	}

	.panel {
		max-width: 80rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 0;
	}

	.panel-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #c5d0dc;
	}

	.panel-title h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #fff;
	}

	.count-badge {
		background: #243044;
		border: 1px solid #2d3a4d;
		border-radius: 9999px;
		padding: 0.1rem 0.45rem;
		font-size: 0.72rem;
		color: #8899aa;
	}

	.new-char-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.85rem;
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
	}

	.new-char-form input {
		flex: 1 1 12rem;
		background: #0a0e14;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		padding: 0.5rem 0.65rem;
		color: #e8ecf1;
	}

	.empty-text {
		color: #8899aa;
		font-size: 0.9rem;
		padding: 1.5rem;
		background: #141b26;
		border: 1px dashed #2d3a4d;
		border-radius: 0.75rem;
		text-align: center;
	}

	.char-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
		table-layout: fixed;
	}

	.char-table .col-character {
		width: 50%;
	}

	.char-table .col-campaign {
		width: 30%;
	}

	.char-table .col-actions {
		width: 20%;
	}

	.char-table thead {
		display: none;
	}

	.char-table th,
	.char-table td {
		padding: 0.85rem 1rem;
		text-align: left;
		vertical-align: middle;
	}

	.char-table tbody td {
		border-bottom: 1px solid #1e2736;
		vertical-align: middle;
	}

	.char-table td.char-campaign,
	.char-table td.char-actions {
		vertical-align: middle;
	}

	.char-campaign {
		font-size: 0.85rem;
		color: #c5d0dc;
	}

	.char-campaign-inner {
		display: flex;
		align-items: center;
		min-height: 3rem;
	}

	.char-actions {
		padding: 1.25rem;
	}

	.char-actions-inner {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		min-height: 3rem;
		white-space: nowrap;
	}

	.char-table tbody tr:last-child td {
		border-bottom: none;
	}

	.char-row {
		position: relative;
	}

	@media (min-width: 768px) {
		.char-table thead {
			display: table-header-group;
		}

		.char-table th {
			padding: 0.65rem 1rem;
			font-size: 0.65rem;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: #8899aa;
			border-bottom: 1px solid #2d3a4d;
		}

		.char-table th.col-actions-head,
		.char-table td.char-actions {
			text-align: right;
		}

		.char-table thead tr:first-child th:first-child {
			border-top-left-radius: 0.75rem;
		}

		.char-table thead tr:first-child th:last-child {
			border-top-right-radius: 0.75rem;
		}
	}

	@media (max-width: 767px) {
		.char-table,
		.char-table tbody,
		.char-table tr,
		.char-table td {
			display: block;
		}

		.char-table tbody td {
			border-bottom: none;
		}

		.char-table tbody tr {
			border-bottom: 1px solid #1e2736;
		}

		.char-table tbody tr:last-child {
			border-bottom: none;
		}

		.char-table td.char-campaign {
			padding-top: 0;
			padding-bottom: 0.35rem;
		}

		.char-table td.char-actions {
			padding-top: 0;
		}
	}

	.char-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.char-portrait {
		width: 3rem;
		height: 3rem;
		border-radius: 0.375rem;
		background: #243044;
		border: 1px solid #3a4d66;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #8899aa;
		flex-shrink: 0;
	}

	.char-portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.char-name {
		color: #fff;
		font-weight: 600;
		text-decoration: none;
	}

	.char-name:hover {
		color: #c9a227;
	}

	.char-meta {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: #8899aa;
	}

	.muted {
		color: #8899aa;
		font-style: italic;
	}

	.menu-wrap {
		position: relative;
		z-index: 1;
	}

	.menu-wrap:focus-within,
	.char-row:has(.dropdown) {
		z-index: 5;
	}

	.dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 0.35rem);
		min-width: 11rem;
		background: #1e2736;
		border: 1px solid #2d3a4d;
		border-radius: 0.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		z-index: 30;
		overflow: hidden;
	}

	.dropdown-up {
		top: auto;
		bottom: calc(100% + 0.35rem);
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 0.6rem 0.85rem;
		background: none;
		border: none;
		color: #c5d0dc;
		font-size: 0.82rem;
		text-align: left;
		cursor: pointer;
	}

	.dropdown-item:hover {
		background: #243044;
	}

	.dropdown-danger {
		color: #e74c3c;
	}

	.campaign-grid {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 960px) {
		.campaign-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.campaign-card {
		display: grid;
		grid-template-columns: 7rem 1fr;
		background: #141b26;
		border: 1px solid #2d3a4d;
		border-radius: 0.75rem;
		overflow: hidden;
		min-height: 12rem;
	}

	@media (min-width: 640px) {
		.campaign-card {
			grid-template-columns: 9rem 1fr;
		}
	}

	.campaign-art {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: rgba(255, 255, 255, 0.35);
	}

	.campaign-body {
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.campaign-top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.campaign-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.campaign-title-row h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.badge {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
	}

	.badge-gm {
		background: rgba(142, 68, 173, 0.25);
		color: #bb86fc;
		border: 1px solid rgba(187, 134, 252, 0.35);
	}

	.invite-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		background: #0a0e14;
		border: 1px solid #2d3a4d;
		border-radius: 0.375rem;
		color: #c5d0dc;
		font-size: 0.72rem;
		font-family: ui-monospace, monospace;
		cursor: pointer;
	}

	.copied-toast {
		font-size: 0.7rem;
		color: #27ae60;
	}

	.campaign-desc {
		margin: 0;
		font-size: 0.78rem;
		color: #8899aa;
		line-height: 1.45;
	}

	.campaign-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1rem;
		font-size: 0.72rem;
		color: #8899aa;
	}

	.campaign-stats i {
		margin-right: 0.25rem;
		color: #5a6a7a;
	}

	.campaign-chars-label {
		display: block;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #8899aa;
		margin-bottom: 0.35rem;
	}

	.campaign-char-list {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.campaign-char-thumb {
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		background: #243044;
		border: 1px solid #3a4d66;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #8899aa;
		font-size: 0.75rem;
		text-decoration: none;
	}

	.campaign-char-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.campaign-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.35rem;
	}

	.tip-bar {
		max-width: 80rem;
		margin: 1.5rem auto 0;
		padding: 0.85rem 1rem;
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		color: #8899aa;
		font-size: 0.82rem;
		border-top: 1px solid #1e2736;
	}

	.tip-bar i {
		color: #c9a227;
		margin-top: 0.1rem;
	}

	.tip-bar p {
		margin: 0;
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

	.btn-purple {
		background: linear-gradient(135deg, #8e44ad, #6c3483);
		color: #fff;
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
		background: #243044;
		border: 1px solid #3a4d66;
		color: #c5d0dc;
		border-radius: 0.375rem;
	}

	.alert-error {
		max-width: 80rem;
		margin: 1rem auto 0;
		padding: 0 1rem;
		color: #e74c3c;
		font-size: 0.85rem;
	}
</style>
