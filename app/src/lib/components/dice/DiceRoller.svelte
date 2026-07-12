<script lang="ts">
	import Die from './Die.svelte';

	type DieState = { id: string; value: number };
	type ScoreRow = { id: string; dice: DieState[] };
	type DragPayload =
		| { source: 'table'; ids: string[] }
		| { source: 'score'; id: string; fromRowId: string };

	const MIN_DICE = 1;
	const MAX_DICE = 20;
	const DEFAULT_DICE = 6;
	const DRAG_MIME = 'application/x-farkpg-dice';

	let diceCount = $state(DEFAULT_DICE);
	let tableDice = $state<DieState[]>([]);
	let scoreRows = $state<ScoreRow[]>([]);
	let rollCount = $state(0);
	let selectedIds = $state<Set<string>>(new Set());
	let rollingIds = $state<Set<string>>(new Set());

	let surfaceEl: HTMLDivElement;
	let marqueeStart: { x: number; y: number; rect: DOMRect } | null = null;
	let marqueeBox = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let dragOverRowId = $state<string | null>(null);
	let dragOverNewRow = $state(false);
	let dragOverTable = $state(false);

	const hasTableSelection = $derived(tableDice.some((d) => selectedIds.has(d.id)));
	const hasTableDice = $derived(tableDice.length > 0);
	const canResetScore = $derived(scoreRows.length > 0);

	function makeId(): string {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
		return `die-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function randomFace(): number {
		if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
			const buf = new Uint32Array(1);
			crypto.getRandomValues(buf);
			return (buf[0] % 6) + 1;
		}
		return Math.floor(Math.random() * 6) + 1;
	}

	function makeDie(): DieState {
		return { id: makeId(), value: randomFace() };
	}

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
		);
	}

	function animate(ids: string[]) {
		if (!ids.length) return;
		const next = new Set(rollingIds);
		for (const id of ids) next.add(id);
		rollingIds = next;
		const duration = prefersReducedMotion() ? 340 : 480;
		setTimeout(() => {
			const cleared = new Set(rollingIds);
			for (const id of ids) cleared.delete(id);
			rollingIds = cleared;
		}, duration);
	}

	function clampCount(): number {
		const n = Math.floor(Number(diceCount) || 0);
		return Math.min(MAX_DICE, Math.max(MIN_DICE, n));
	}

	function startRoll() {
		const n = clampCount();
		diceCount = n;
		const dice = Array.from({ length: n }, makeDie);
		tableDice = dice;
		rollCount += 1;
		selectedIds = new Set();
		animate(dice.map((d) => d.id));
	}

	function rerollAll() {
		if (!tableDice.length) return;
		tableDice = tableDice.map((d) => ({ ...d, value: randomFace() }));
		rollCount += 1;
		selectedIds = new Set();
		animate(tableDice.map((d) => d.id));
	}

	function freeReroll() {
		const ids = tableDice.filter((d) => selectedIds.has(d.id)).map((d) => d.id);
		if (!ids.length) return;
		const idSet = new Set(ids);
		tableDice = tableDice.map((d) => (idSet.has(d.id) ? { ...d, value: randomFace() } : d));
		animate(ids);
	}

	function resetScore() {
		scoreRows = [];
	}

	function toggleSelect(id: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function clearSelection() {
		if (selectedIds.size) selectedIds = new Set();
	}

	function onContextMenu(e: MouseEvent) {
		if (!selectedIds.size) return;
		e.preventDefault();
		clearSelection();
	}

	function rectsIntersect(
		a: { left: number; top: number; right: number; bottom: number },
		b: DOMRect
	): boolean {
		return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
	}

	function onSurfacePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('[data-die-id]')) return;
		e.preventDefault();
		const rect = surfaceEl.getBoundingClientRect();
		marqueeStart = { x: e.clientX, y: e.clientY, rect };
		marqueeBox = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 };
		surfaceEl.setPointerCapture(e.pointerId);
	}

	function onSurfacePointerMove(e: PointerEvent) {
		if (!marqueeStart) return;
		const { x: startX, y: startY, rect } = marqueeStart;
		const x = Math.min(startX, e.clientX) - rect.left;
		const y = Math.min(startY, e.clientY) - rect.top;
		const w = Math.abs(e.clientX - startX);
		const h = Math.abs(e.clientY - startY);
		marqueeBox = { x, y, w, h };
	}

	function endMarquee(e: PointerEvent) {
		if (!marqueeStart) return;
		if (surfaceEl.hasPointerCapture(e.pointerId)) surfaceEl.releasePointerCapture(e.pointerId);
		const box = marqueeBox;
		const rect = marqueeStart.rect;
		marqueeStart = null;
		marqueeBox = null;
		if (!box || (box.w < 4 && box.h < 4)) {
			clearSelection();
			return;
		}
		const absBox = {
			left: rect.left + box.x,
			top: rect.top + box.y,
			right: rect.left + box.x + box.w,
			bottom: rect.top + box.y + box.h
		};
		const next = new Set(selectedIds);
		surfaceEl.querySelectorAll<HTMLElement>('[data-die-id]').forEach((el) => {
			const dieRect = el.getBoundingClientRect();
			if (rectsIntersect(absBox, dieRect)) {
				const id = el.dataset.dieId;
				if (id) next.add(id);
			}
		});
		selectedIds = next;
	}

	function onTableDieDragStart(e: DragEvent, id: string) {
		// Dragging an unselected die selects just that die, so a single drag
		// gesture both selects and moves it. Dragging a die that's already
		// part of a multi-selection drags the whole selection.
		if (!selectedIds.has(id)) {
			selectedIds = new Set([id]);
		}
		const ids = tableDice.filter((d) => selectedIds.has(d.id)).map((d) => d.id);
		const payload: DragPayload = { source: 'table', ids };
		e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onScoreDieDragStart(e: DragEvent, id: string, fromRowId: string) {
		const payload: DragPayload = { source: 'score', id, fromRowId };
		e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function readDragPayload(dt: DataTransfer | null): DragPayload | null {
		if (!dt) return null;
		try {
			const raw = dt.getData(DRAG_MIME);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed?.source === 'table' && Array.isArray(parsed.ids)) {
					const ids = parsed.ids.map(String).filter(Boolean);
					if (ids.length) return { source: 'table', ids };
				}
				if (parsed?.source === 'score' && parsed.id) {
					return {
						source: 'score',
						id: String(parsed.id),
						fromRowId: String(parsed.fromRowId ?? '')
					};
				}
			}
		} catch {
			/* fall through to single-id fallback below */
		}
		const one = dt.getData('text/plain');
		return one ? { source: 'table', ids: [one] } : null;
	}

	/** Move dice currently in the rolling area into a score row (or a new row when `rowId` is null). */
	function moveTableDiceToRow(ids: string[], rowId: string | null) {
		const idSet = new Set(ids);
		const moving = tableDice.filter((d) => idSet.has(d.id));
		if (!moving.length) return;
		tableDice = tableDice.filter((d) => !idSet.has(d.id));
		if (rowId) {
			scoreRows = scoreRows.map((row) =>
				row.id === rowId ? { ...row, dice: [...row.dice, ...moving] } : row
			);
		} else {
			scoreRows = [...scoreRows, { id: makeId(), dice: moving }];
		}
		const nextSelected = new Set(selectedIds);
		for (const id of ids) nextSelected.delete(id);
		selectedIds = nextSelected;
	}

	/** Move a single scored die into another row (or a new row when `toRowId` is null). */
	function moveScoreDieToRow(id: string, fromRowId: string, toRowId: string | null) {
		if (toRowId === fromRowId) return;
		let moving: DieState | undefined;
		const withoutDie = scoreRows
			.map((row) => {
				if (row.id !== fromRowId) return row;
				const idx = row.dice.findIndex((d) => d.id === id);
				if (idx === -1) return row;
				moving = row.dice[idx];
				return { ...row, dice: row.dice.filter((d) => d.id !== id) };
			})
			.filter((row) => row.dice.length > 0);
		if (!moving) return;
		if (toRowId) {
			scoreRows = withoutDie.map((row) =>
				row.id === toRowId ? { ...row, dice: [...row.dice, moving!] } : row
			);
		} else {
			scoreRows = [...withoutDie, { id: makeId(), dice: [moving] }];
		}
	}

	/** Move a scored die back into the rolling area. */
	function moveScoreDieToTable(id: string, fromRowId: string) {
		let moving: DieState | undefined;
		const withoutDie = scoreRows
			.map((row) => {
				if (row.id !== fromRowId) return row;
				const idx = row.dice.findIndex((d) => d.id === id);
				if (idx === -1) return row;
				moving = row.dice[idx];
				return { ...row, dice: row.dice.filter((d) => d.id !== id) };
			})
			.filter((row) => row.dice.length > 0);
		if (!moving) return;
		scoreRows = withoutDie;
		tableDice = [...tableDice, moving];
	}

	function onSurfaceDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function onSurfaceDragEnter(e: DragEvent) {
		e.preventDefault();
		dragOverTable = true;
	}

	function onSurfaceDragLeave(e: DragEvent) {
		const related = e.relatedTarget as Node | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		dragOverTable = false;
	}

	function onSurfaceDrop(e: DragEvent) {
		e.preventDefault();
		dragOverTable = false;
		const payload = readDragPayload(e.dataTransfer);
		if (!payload || payload.source !== 'score') return;
		moveScoreDieToTable(payload.id, payload.fromRowId);
	}

	function onScoreAreaDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function onScoreAreaDragEnter(e: DragEvent) {
		e.preventDefault();
		dragOverNewRow = true;
	}

	function onScoreAreaDragLeave(e: DragEvent) {
		const related = e.relatedTarget as Node | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		dragOverNewRow = false;
	}

	function onScoreAreaDrop(e: DragEvent) {
		e.preventDefault();
		dragOverNewRow = false;
		dragOverRowId = null;
		const payload = readDragPayload(e.dataTransfer);
		if (!payload) return;
		if (payload.source === 'table') moveTableDiceToRow(payload.ids, null);
		else moveScoreDieToRow(payload.id, payload.fromRowId, null);
	}

	function onRowDragEnter(e: DragEvent, rowId: string) {
		e.preventDefault();
		e.stopPropagation();
		dragOverRowId = rowId;
	}

	function onRowDragLeave(e: DragEvent, rowId: string) {
		const related = e.relatedTarget as Node | null;
		if (related && (e.currentTarget as HTMLElement).contains(related)) return;
		if (dragOverRowId === rowId) dragOverRowId = null;
	}

	function onRowDrop(e: DragEvent, rowId: string) {
		e.preventDefault();
		e.stopPropagation();
		dragOverRowId = null;
		dragOverNewRow = false;
		const payload = readDragPayload(e.dataTransfer);
		if (!payload) return;
		if (payload.source === 'table') moveTableDiceToRow(payload.ids, rowId);
		else moveScoreDieToRow(payload.id, payload.fromRowId, rowId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dice-roller" oncontextmenu={onContextMenu}>
	<div class="toolbar card">
		<div class="toolbar-main">
			<div class="toolbar-row">
				<button type="button" class="btn-primary" onclick={startRoll}>Start Roll</button>
				<label class="count-field">
					<span>Dice to roll</span>
					<input
						class="field count-input"
						type="number"
						min={MIN_DICE}
						max={MAX_DICE}
						bind:value={diceCount}
					/>
				</label>
			</div>
			{#if hasTableDice}
				<div class="toolbar-row">
					<button type="button" class="btn-reroll" onclick={rerollAll}>
						Re-roll current dice
					</button>
					{#if hasTableSelection}
						<button type="button" class="btn-free-reroll" onclick={freeReroll}>
							Free re-roll
						</button>
					{/if}
				</div>
			{/if}
		</div>
		<div class="roll-count" title="Total rolls made with Start Roll / Re-roll">
			<span class="roll-count-label">Rolls</span>
			<span class="roll-count-value">{rollCount}</span>
		</div>
	</div>

	<div class="regions">
		<section class="region region-roll card">
			<header>
				Rolling area
				<span class="hint">
					drag a die to move it · click, or click-drag, to multi-select · right-click to
					deselect
				</span>
			</header>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="surface"
				class:drag-active={dragOverTable}
				bind:this={surfaceEl}
				onpointerdown={onSurfacePointerDown}
				onpointermove={onSurfacePointerMove}
				onpointerup={endMarquee}
				onpointercancel={endMarquee}
				ondragover={onSurfaceDragOver}
				ondragenter={onSurfaceDragEnter}
				ondragleave={onSurfaceDragLeave}
				ondrop={onSurfaceDrop}
			>
				{#if marqueeBox}
					<div
						class="marquee"
						style="left:{marqueeBox.x}px; top:{marqueeBox.y}px; width:{marqueeBox.w}px; height:{marqueeBox.h}px;"
					></div>
				{/if}
				{#each tableDice as die (die.id)}
					<Die
						dieId={die.id}
						value={die.value}
						selected={selectedIds.has(die.id)}
						rolling={rollingIds.has(die.id)}
						draggable={true}
						onSelect={(e) => toggleSelect(die.id, e)}
						onDragStart={(e) => onTableDieDragStart(e, die.id)}
					/>
				{:else}
					<p class="empty">No dice yet — set a count and click Start Roll.</p>
				{/each}
			</div>
		</section>

		<section class="region region-score card">
			<header>Score area</header>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="score-rows"
				class:drag-active={dragOverNewRow}
				ondragover={onScoreAreaDragOver}
				ondragenter={onScoreAreaDragEnter}
				ondragleave={onScoreAreaDragLeave}
				ondrop={onScoreAreaDrop}
			>
				{#each scoreRows as row (row.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="score-row"
						class:drag-active={dragOverRowId === row.id}
						ondragover={onScoreAreaDragOver}
						ondragenter={(e) => onRowDragEnter(e, row.id)}
						ondragleave={(e) => onRowDragLeave(e, row.id)}
						ondrop={(e) => onRowDrop(e, row.id)}
					>
						{#each row.dice as die (die.id)}
							<Die
								dieId={die.id}
								value={die.value}
								selected={false}
								rolling={false}
								draggable={true}
								size="sm"
								onSelect={() => {}}
								onDragStart={(e) => onScoreDieDragStart(e, die.id, row.id)}
							/>
						{/each}
					</div>
				{:else}
					<p class="empty">Drag selected dice here to score them.</p>
				{/each}
			</div>
			<button
				type="button"
				class="btn-ghost reset-score-btn"
				onclick={resetScore}
				disabled={!canResetScore}
			>
				Reset score
			</button>
		</section>
	</div>

	<details class="instructions card" open>
		<summary>How to use the dice roller</summary>
		<ul>
			<li>Set a dice count and click <strong>Start Roll</strong> to fill the rolling area.</li>
			<li>
				<strong>Re-roll current dice</strong> re-rolls every die currently in the rolling area
				(it only shows up once there are dice to re-roll).
			</li>
			<li>
				Just drag a die straight into the score area to score it — no need to select it first.
			</li>
			<li>
				To move several at once, click dice to select them (or click-drag across empty space to
				select many), then drag any one of the selected dice.
			</li>
			<li>Right-click anywhere to clear your current selection.</li>
			<li>
				Once dice are selected, a <strong>Free re-roll</strong> button appears — it re-rolls only
				the selected dice and does not add to your roll count.
			</li>
			<li>
				Drop dice on an existing score row to add to it, or on empty space in the score area to
				start a new row.
			</li>
			<li>
				Dice already in the score area can be dragged between rows, or back into the rolling
				area, at any time.
			</li>
			<li><strong>Reset score</strong> clears every scored row.</li>
			<li>The <strong>Rolls</strong> counter tracks every Start Roll / Re-roll click.</li>
		</ul>
	</details>
</div>

<style>
	.dice-roller {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.toolbar-main {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.toolbar-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem;
	}

	.count-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.75rem;
		color: var(--app-muted);
	}

	.count-input {
		width: 5rem;
	}

	.btn-reroll {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-radius: 0.375rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid #6b5210;
		background: linear-gradient(180deg, #d4a82a, #a67f18);
		color: #1c1404;
		transition: filter 0.15s ease;
	}

	.btn-reroll:hover {
		filter: brightness(1.08);
	}

	.btn-free-reroll {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-radius: 0.375rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: 2px dashed var(--app-accent);
		background: color-mix(in srgb, var(--app-accent) 14%, transparent);
		color: var(--app-accent);
		transition: filter 0.15s ease;
	}

	.btn-free-reroll:hover {
		filter: brightness(1.15);
	}

	.roll-count {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		min-width: 3.5rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--app-edge-strong);
		border-radius: 0.375rem;
		background: var(--app-bg);
	}

	.roll-count-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--app-muted);
	}

	.roll-count-value {
		font-size: 1.1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.regions {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 15rem;
		gap: 0.75rem;
		align-items: stretch;
	}

	@media (max-width: 640px) {
		.regions {
			grid-template-columns: 1fr;
		}
	}

	.region {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
	}

	.region header {
		font-weight: 600;
		font-size: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.hint {
		font-weight: normal;
		font-size: 0.72rem;
		color: var(--app-muted);
	}

	.surface {
		position: relative;
		flex: 1;
		min-height: 220px;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.18);
		touch-action: none;
	}

	.surface.drag-active {
		box-shadow: inset 0 0 0 2px var(--app-accent);
		background: color-mix(in srgb, var(--app-accent) 12%, rgba(0, 0, 0, 0.18));
	}

	.marquee {
		position: absolute;
		z-index: 1;
		pointer-events: none;
		border: 1px dashed var(--app-accent);
		background: color-mix(in srgb, var(--app-accent) 15%, transparent);
	}

	.empty {
		margin: auto;
		opacity: 0.65;
		font-size: 0.85rem;
		text-align: center;
		padding: 1rem;
	}

	.score-rows {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 220px;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.18);
		overflow-y: auto;
	}

	.score-rows.drag-active {
		box-shadow: inset 0 0 0 2px var(--app-accent);
		background: color-mix(in srgb, var(--app-accent) 12%, rgba(0, 0, 0, 0.18));
	}

	.score-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.3rem;
		padding: 0.4rem;
		border: 1px dashed var(--app-edge-strong);
		border-radius: 0.4rem;
	}

	.score-row.drag-active {
		border-style: solid;
		border-color: var(--app-accent);
		background: color-mix(in srgb, var(--app-accent) 18%, transparent);
	}

	.reset-score-btn {
		align-self: flex-end;
	}

	.instructions summary {
		cursor: pointer;
		font-weight: 600;
	}

	.instructions ul {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.875rem;
		color: var(--app-muted);
	}
</style>
