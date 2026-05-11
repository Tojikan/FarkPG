<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		ZNZ_ATTR_LABELS,
		ZNZ_ATTR_BLURBS,
		ZNZ_CORE_SKILLS,
		ZNZ_ADDON_PRESETS,
		ZNZ_KNOWLEDGE_PRESETS,
		ZNZ_STARTING_ABILITIES,
		type ZnzAttrKey
	} from '$lib/data/znz/definitions';
	import {
		STORAGE_KEY_ZNZ,
		createInitialWizardDraft,
		draftToCharacter,
		znzDerivedCaps,
		znzLoadPersisted,
		znzSavePersisted,
		znzPointsSpentForAttribute,
		znzRemainingSkillPoints,
		znzSkillPoolSize,
		znzNewLineId,
		znzBuildExportJson,
		type ZnzCharacter,
		type ZnzPersistedV1,
		type ZnzWizardDraft,
		type ZnzWizardStep
	} from '$lib/data/znz/model';

	// ZnZ attributes use a 10-point buy pool where each attribute point costs 1.
	// Each attribute is clamped to 1..6 and we enforce Body+Adroit+Mind <= 10.
	const ATTR_POOL = 10;
	const ATTR_MIN = 1;
	const ATTR_MAX = 6;
	const ATTR_KEYS: ZnzAttrKey[] = ['body', 'adroit', 'mind'];
	const SKILL_CAP = 8;

	/** Coerce any stored / input value to a legal integer attribute rating. */
	function znzAttrCoerce(v: unknown): number {
		const n = Number(v);
		if (!Number.isFinite(n)) return ATTR_MIN;
		return Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(n)));
	}

	function znzAttrSum(attrs: Record<ZnzAttrKey, number>): number {
		return ATTR_KEYS.reduce((acc, k) => acc + znzAttrCoerce(attrs[k]), 0);
	}

	/**
	 * For `<input type="number" max=…>`: native spinners honor `max` before JS runs.
	 * Never use ATTR_MAX alone when the pool is tighter — otherwise the UI can show
	 * "Remaining: 0" while the stepper still raises a stat toward 6.
	 */
	function znzAttrHtmlMax(attrs: Record<ZnzAttrKey, number>, key: ZnzAttrKey): number {
		const cur = znzAttrCoerce(attrs[key]);
		const otherSum = ATTR_KEYS.filter((k) => k !== key).reduce((acc, k) => acc + znzAttrCoerce(attrs[k]), 0);
		const byPool = ATTR_POOL - otherSum;
		return Math.max(cur, Math.min(ATTR_MAX, byPool));
	}

	/** Wheel on focused number inputs changes values without always firing `input` consistently. */
	function znzSuppressWheelWhenFocused(node: HTMLInputElement) {
		const fn = (e: WheelEvent) => {
			if (document.activeElement === node) e.preventDefault();
		};
		node.addEventListener('wheel', fn, { passive: false });
		return {
			destroy() {
				node.removeEventListener('wheel', fn);
			}
		};
	}

	let mode = $state<'empty' | 'wizard' | 'sheet'>('empty');
	let character = $state<ZnzCharacter | null>(null);
	let wizard = $state<ZnzWizardDraft | null>(null);
	let exportStatus = $state('');
	let hydrated = $state(false);

	const chosenAbilityId = $derived(character?.startingAbilityId ?? null);
	const chosenAbility = $derived(
		chosenAbilityId ? ZNZ_STARTING_ABILITIES.find((ab) => ab.id === chosenAbilityId) ?? null : null
	);

	const availableExtraAbilities = $derived(
		character
			? ZNZ_STARTING_ABILITIES.filter(
					(ab) =>
						ab.id !== character.startingAbilityId &&
						!(character.additionalAbilityIds ?? []).includes(ab.id)
				)
			: []
	);

	function persist() {
		const state: ZnzPersistedV1 = {
			version: 1,
			mode,
			wizard,
			character
		};
		znzSavePersisted(state);
	}

	$effect(() => {
		if (!hydrated) return;
		persist();
	});

	onMount(() => {
		const loaded = znzLoadPersisted();
		if (loaded.mode === 'sheet' && loaded.character) {
			mode = 'sheet';
			const attrs = normalizeZnzAttributesFromSaved(loaded.character.attributes);
			const caps = znzDerivedCaps(attrs);
			const prev = loaded.character;
			character = {
				...prev,
				attributes: attrs,
				resources: {
					...prev.resources,
					health: {
						...prev.resources.health,
						max: caps.maxHealth,
						value: Math.min(prev.resources.health.value, caps.maxHealth)
					},
					actionPoints: {
						...prev.resources.actionPoints,
						max: caps.maxAp,
						value: Math.min(prev.resources.actionPoints.value, caps.maxAp)
					},
					movement: caps.movement
				}
			};
			wizard = null;
		} else if (loaded.mode === 'wizard' && loaded.wizard) {
			mode = 'wizard';
			wizard = {
				...loaded.wizard,
				attributes: normalizeZnzAttributesFromSaved(loaded.wizard.attributes)
			};
			character = null;
		} else {
			mode = 'empty';
			character = null;
			wizard = null;
		}
		hydrated = true;
	});

	function startWizard() {
		mode = 'wizard';
		wizard = createInitialWizardDraft();
		character = null;
	}

	function cancelToEmpty() {
		if (typeof window !== 'undefined') {
			if (!window.confirm('Leave character creation? Unsaved progress in this session is still stored unless you clear it.')) return;
		}
		mode = 'empty';
		wizard = null;
	}

	function attrForWizardStep(step: ZnzWizardStep): ZnzAttrKey | null {
		if (step === 3) return 'body';
		if (step === 4) return 'adroit';
		if (step === 5) return 'mind';
		return null;
	}

	function cloneDraft(d: ZnzWizardDraft): ZnzWizardDraft {
		return {
			step: d.step,
			name: d.name,
			biography: d.biography,
			attributes: { ...d.attributes },
			skills: { ...d.skills },
			addonRanks: { ...d.addonRanks },
			knowledgeLines: d.knowledgeLines.map((k) => ({ ...k })),
			customSkills: d.customSkills.map((c) => ({ ...c })),
			startingAbilityId: d.startingAbilityId
		};
	}

	function tryMutateDraft(attr: ZnzAttrKey, fn: (d: ZnzWizardDraft) => void): void {
		if (!wizard) return;
		const copy = cloneDraft(wizard);
		fn(copy);
		if (znzPointsSpentForAttribute(copy, attr) <= znzSkillPoolSize(attr)) {
			wizard = copy;
		}
	}

	function bumpCoreSkill(attr: ZnzAttrKey, skillId: string, delta: number) {
		if (!wizard) return;
		const cur = wizard.skills[skillId] ?? 0;
		const next = Math.max(0, Math.min(SKILL_CAP, cur + delta));
		if (next === cur) return;
		tryMutateDraft(attr, (d) => {
			d.skills[skillId] = next;
		});
	}

	function bumpAddon(attr: ZnzAttrKey, addonId: string, delta: number) {
		if (!wizard) return;
		const preset = ZNZ_ADDON_PRESETS.find((a) => a.id === addonId);
		if (!preset || preset.attribute !== attr) return;
		const cur = wizard.addonRanks[addonId] ?? 0;
		const next = Math.max(0, Math.min(SKILL_CAP, cur + delta));
		if (next === cur) return;
		tryMutateDraft(attr, (d) => {
			if (next === 0) delete d.addonRanks[addonId];
			else d.addonRanks[addonId] = next;
		});
	}

	function bumpKnowledgeRank(lineId: string, delta: number) {
		if (!wizard) return;
		const idx = wizard.knowledgeLines.findIndex((l) => l.id === lineId);
		if (idx < 0) return;
		const cur = wizard.knowledgeLines[idx].rank;
		const next = Math.max(0, Math.min(SKILL_CAP, cur + delta));
		if (next === cur) return;
		tryMutateDraft('mind', (d) => {
			d.knowledgeLines[idx].rank = next;
		});
	}

	function bumpCustomSkill(id: string, delta: number) {
		if (!wizard) return;
		const idx = wizard.customSkills.findIndex((c) => c.id === id);
		if (idx < 0) return;
		const attr = wizard.customSkills[idx].attribute;
		const cur = wizard.customSkills[idx].rank;
		const next = Math.max(0, Math.min(SKILL_CAP, cur + delta));
		if (next === cur) return;
		tryMutateDraft(attr, (d) => {
			d.customSkills[idx].rank = next;
		});
	}

	function addKnowledgeLine() {
		if (!wizard) return;
		const line = {
			id: znzNewLineId('know'),
			presetId: ZNZ_KNOWLEDGE_PRESETS[0]?.id ?? 'engineering',
			detail: '',
			rank: 0
		};
		wizard = { ...wizard, knowledgeLines: [...wizard.knowledgeLines, line] };
	}

	function removeKnowledgeLine(id: string) {
		if (!wizard) return;
		wizard = { ...wizard, knowledgeLines: wizard.knowledgeLines.filter((l) => l.id !== id) };
	}

	function updateKnowledgeLine(id: string, patch: Partial<{ presetId: string; detail: string }>) {
		if (!wizard) return;
		wizard = {
			...wizard,
			knowledgeLines: wizard.knowledgeLines.map((l) => (l.id === id ? { ...l, ...patch } : l))
		};
	}

	function addCustomSkill(attr: ZnzAttrKey) {
		if (!wizard) return;
		const row = {
			id: znzNewLineId('custom'),
			label: '',
			description: '',
			attribute: attr,
			rank: 0
		};
		wizard = { ...wizard, customSkills: [...wizard.customSkills, row] };
	}

	function updateCustomSkill(id: string, patch: Partial<{ label: string; description: string }>) {
		if (!wizard) return;
		wizard = {
			...wizard,
			customSkills: wizard.customSkills.map((c) => (c.id === id ? { ...c, ...patch } : c))
		};
	}

	function removeCustomSkill(id: string) {
		if (!wizard) return;
		wizard = { ...wizard, customSkills: wizard.customSkills.filter((c) => c.id !== id) };
	}

	function wizardNext() {
		if (!wizard) return;
		if (wizard.step === 1) {
			if (!wizard.name.trim()) {
				alert('Enter a name to continue.');
				return;
			}
			wizard = { ...wizard, step: 2 };
			return;
		}
		if (wizard.step === 2) {
			const sum = znzAttrSum(wizard.attributes);
			if (sum > ATTR_POOL) {
				alert(`Attribute points exceed the pool (${sum} / ${ATTR_POOL}).`);
				return;
			}
			wizard = { ...wizard, step: 3 };
			return;
		}
		if (wizard.step >= 3 && wizard.step <= 4) {
			wizard = { ...wizard, step: (wizard.step + 1) as ZnzWizardStep };
			return;
		}
		if (wizard.step === 5) {
			wizard = { ...wizard, step: 6 };
			return;
		}
	}

	function wizardBack() {
		if (!wizard) return;
		if (wizard.step <= 1) return;
		wizard = { ...wizard, step: (wizard.step - 1) as ZnzWizardStep };
	}

	function finishWizard() {
		if (!wizard) return;
		if (!wizard.startingAbilityId) {
			alert('Choose one starting ability.');
			return;
		}
		character = draftToCharacter(wizard);
		mode = 'sheet';
		wizard = null;
	}

	function buildNewCharacter() {
		if (typeof window === 'undefined') return;
		if (
			!window.confirm(
				'Start a new character? Existing character data will be removed from this device for ZnZ.'
			)
		) {
			return;
		}
		mode = 'empty';
		character = null;
		wizard = null;
		try {
			localStorage.removeItem(STORAGE_KEY_ZNZ);
			znzSavePersisted({ version: 1, mode: 'empty', wizard: null, character: null });
		} catch {
			/* ignore */
		}
	}

	async function exportClipboard() {
		if (!character) return;
		const text = znzBuildExportJson(character);
		try {
			await navigator.clipboard.writeText(text);
			exportStatus = 'Copied JSON to clipboard.';
		} catch {
			exportStatus = 'Clipboard failed — copy from console or try HTTPS.';
		}
		setTimeout(() => {
			exportStatus = '';
		}, 4000);
	}

	function setAttrWizard(key: ZnzAttrKey, v: number) {
		if (!wizard) return;
		wizard = { ...wizard, attributes: applyZnzAttributeChange(key, v, wizard.attributes) };
	}

	/** Clamp each attribute to 1..6; if total still exceeds the pool, lower highest stats (load migration only). */
	function normalizeZnzAttributesFromSaved(attrs: Record<ZnzAttrKey, number>): Record<ZnzAttrKey, number> {
		const next: Record<ZnzAttrKey, number> = { ...attrs };
		for (const k of ATTR_KEYS) {
			next[k] = znzAttrCoerce(next[k]);
		}
		let sum = ATTR_KEYS.reduce((acc, k) => acc + next[k], 0);
		while (sum > ATTR_POOL) {
			let pick: ZnzAttrKey | null = null;
			let best = -1;
			for (const k of ATTR_KEYS) {
				if (next[k] > ATTR_MIN && next[k] > best) {
					best = next[k];
					pick = k;
				}
			}
			if (!pick) break;
			next[pick]--;
			sum--;
		}
		return next;
	}

	/**
	 * Only changes `editedKey`. Does not lower other attributes: the new value is capped so
	 * body+adroit+mind <= ATTR_POOL given the others unchanged.
	 *
	 * Important: when the other two stats already use the full pool, `ATTR_POOL - otherSum` is 0.
	 * Do not clamp that "room" up to ATTR_MIN — that would incorrectly allow a third 1 and total 11.
	 */
	function applyZnzAttributeChange(
		editedKey: ZnzAttrKey,
		rawValue: number,
		attrs: Record<ZnzAttrKey, number>
	): Record<ZnzAttrKey, number> {
		const prev = znzAttrCoerce(attrs[editedKey]);
		const rd = Number(rawValue);
		const want = Number.isFinite(rd) ? znzAttrCoerce(rd) : prev;

		const otherSum = ATTR_KEYS.filter((k) => k !== editedKey).reduce((acc, k) => acc + znzAttrCoerce(attrs[k]), 0);
		const maxVal = Math.min(ATTR_MAX, ATTR_POOL - otherSum);

		if (maxVal < ATTR_MIN) {
			return { ...attrs, [editedKey]: prev };
		}

		const capped = Math.min(want, maxVal);
		return { ...attrs, [editedKey]: Math.max(ATTR_MIN, capped) };
	}

	function patchCharacter(fn: (c: ZnzCharacter) => ZnzCharacter) {
		if (!character) return;
		character = fn(character);
	}

	function addAdditionalAbility(id: string) {
		if (!id || !character) return;
		patchCharacter((c) => {
			if (id === c.startingAbilityId) return c;
			const cur = c.additionalAbilityIds ?? [];
			if (cur.includes(id) || !ZNZ_STARTING_ABILITIES.some((a) => a.id === id)) return c;
			return { ...c, additionalAbilityIds: [...cur, id] };
		});
	}

	function removeAdditionalAbility(id: string) {
		patchCharacter((c) => ({
			...c,
			additionalAbilityIds: (c.additionalAbilityIds ?? []).filter((x) => x !== id)
		}));
	}
</script>

<svelte:head>
	<title>ZnZ (zombie survival) character builder – FarkPG</title>
</svelte:head>

<div class="znz-page">
	<div class="znz-toolbar">
		<a href="{base}/builders" class="znz-back">← Builders</a>
		{#if mode === 'wizard'}
			<div class="znz-toolbar-actions">
				<button type="button" class="znz-btn znz-btn-ghost" onclick={cancelToEmpty}>Cancel</button>
			</div>
		{/if}
		{#if mode === 'sheet' && character}
			<div class="znz-toolbar-actions">
				<button type="button" class="znz-btn znz-btn-ghost" onclick={exportClipboard}>Export JSON</button>
				<button type="button" class="znz-btn znz-btn-danger" onclick={buildNewCharacter}>Build new character</button>
			</div>
		{/if}
	</div>

	{#if exportStatus}
		<p class="znz-toast" role="status">{exportStatus}</p>
	{/if}

	{#if mode === 'empty'}
		<div class="znz-empty">
			<div class="znz-empty-card">
				<h1 class="znz-title">FarkPG ZnZ</h1>
				<p class="znz-tagline">Time to cancel the Apocalpyse</p>
				<button type="button" class="znz-btn znz-btn-primary znz-btn-build" onclick={startWizard}>Build character</button>
			</div>
		</div>
	{:else if mode === 'wizard' && wizard}
		{@const attrStep = attrForWizardStep(wizard.step)}
		<div class="znz-wizard">
			<div class="znz-wizard-head">
				<h1 class="znz-title">Create survivor</h1>
				<p class="znz-step-label">
					Step {wizard.step} of 6
					{#if wizard.step === 1}
						— Name
					{:else if wizard.step === 2}
						— Attributes
					{:else if wizard.step === 3}
						— Body skills
					{:else if wizard.step === 4}
						— Adroit skills
					{:else if wizard.step === 5}
						— Mind skills
					{:else}
						— Starting ability
					{/if}
				</p>
			</div>

			<div class="znz-wizard-body">
				{#if wizard.step === 1}
					<label class="znz-field-label" for="znz-name">Name</label>
					<input
						id="znz-name"
						class="znz-input"
						type="text"
						placeholder="Survivor name"
						value={wizard.name}
						oninput={(e) => {
							if (!wizard) return;
							wizard = { ...wizard, name: (e.target as HTMLInputElement).value };
						}}
					/>
					<label class="znz-field-label" for="znz-bio-builder">Biography</label>
					<textarea
						id="znz-bio-builder"
						class="znz-textarea"
						rows="4"
						placeholder="Background, notes, personality"
						value={wizard.biography}
						oninput={(e) => {
							if (!wizard) return;
							wizard = { ...wizard, biography: (e.target as HTMLTextAreaElement).value };
						}}
					></textarea>
				{:else if wizard.step === 2}
					{@const caps = znzDerivedCaps(wizard.attributes)}
					<p class="znz-hint">
						Set each attribute ({ATTR_MIN}–{ATTR_MAX}). Derived stats update automatically.
						<br />
						10-point buy: total of all attributes must be &lt;= {ATTR_POOL}. Remaining:
						<strong>
							{Math.max(0, ATTR_POOL - znzAttrSum(wizard.attributes))}
						</strong>.
					</p>
					<div class="znz-attr-grid">
						{#each ATTR_KEYS as k (k)}
							<div class="znz-attr-box">
								<div class="znz-attr-title">{ZNZ_ATTR_LABELS[k]}</div>
								<p class="znz-attr-blurb">{ZNZ_ATTR_BLURBS[k]}</p>
								<input
									class="znz-input znz-input-number"
									type="number"
									min={ATTR_MIN}
									max={znzAttrHtmlMax(wizard.attributes, k)}
									step="1"
									value={znzAttrCoerce(wizard.attributes[k])}
									use:znzSuppressWheelWhenFocused
									oninput={(e) =>
										setAttrWizard(k, Number((e.target as HTMLInputElement).value))}
								/>
							</div>
						{/each}
					</div>
					<div class="znz-derived-panel" aria-live="polite">
						<div><span class="znz-derived-k">Max health</span><span class="znz-derived-v">{caps.maxHealth}</span></div>
						<div><span class="znz-derived-k">Movement</span><span class="znz-derived-v">{caps.movement}</span></div>
						<div><span class="znz-derived-k">Max AP</span><span class="znz-derived-v">{caps.maxAp}</span></div>
					</div>
				{:else if attrStep}
					{@const pool = znzSkillPoolSize(attrStep)}
					{@const spent = znzPointsSpentForAttribute(wizard, attrStep)}
					{@const rem = znzRemainingSkillPoints(wizard, attrStep)}
					<div class="znz-attribute-header">
						<h2 class="znz-attribute-title">{ZNZ_ATTR_LABELS[attrStep]} Skills</h2>
						<p class="znz-hint">{ZNZ_ATTR_BLURBS[attrStep]}</p>
					</div>
					<p class="znz-hint">
						Spend up to <strong>{pool}</strong> points on {ZNZ_ATTR_LABELS[attrStep]} skills. Each rank costs 1, then 2, then 3…
						to raise that skill (triangular cost). Remaining: <strong>{rem}</strong>.
					</p>

					<h2 class="znz-subtitle">Core skills</h2>
					<ul class="znz-skill-list">
						{#each ZNZ_CORE_SKILLS[attrStep] as s}
							<li class="znz-skill-row">
								<div class="znz-skill-text">
									<span class="znz-skill-name">{s.label}</span>
									<span class="znz-skill-desc">{s.description}</span>
								</div>
								<div class="znz-stepper">
									<button
										type="button"
										class="znz-stepper-btn"
										onclick={() => bumpCoreSkill(attrStep, s.id, -1)}>−</button>
									<span class="znz-rank">{wizard.skills[s.id] ?? 0}</span>
									<button
										type="button"
										class="znz-stepper-btn"
										onclick={() => bumpCoreSkill(attrStep, s.id, 1)}>+</button>
								</div>
							</li>
						{/each}
					</ul>

					<h2 class="znz-subtitle znz-divider">Add-on skills</h2>
					<ul class="znz-skill-list">
						{#each ZNZ_ADDON_PRESETS.filter((a) => a.attribute === attrStep && a.kind !== 'knowledge') as a}
							<li class="znz-skill-row">
								<div class="znz-skill-text">
									<span class="znz-skill-name">{a.label}</span>
									<span class="znz-skill-desc">{a.description}</span>
								</div>
								<div class="znz-stepper">
									<button type="button" class="znz-stepper-btn" onclick={() => bumpAddon(attrStep, a.id, -1)}>−</button>
									<span class="znz-rank">{wizard.addonRanks[a.id] ?? 0}</span>
									<button type="button" class="znz-stepper-btn" onclick={() => bumpAddon(attrStep, a.id, 1)}>+</button>
								</div>
							</li>
						{/each}
					</ul>

					{#if attrStep === 'mind'}
						<h2 class="znz-subtitle znz-divider">Knowledges</h2>
						<p class="znz-hint">Add one or more knowledge specialties. Use the detail field for science subject or other notes.</p>
						{#each wizard.knowledgeLines as line}
							<div class="znz-know-card">
								<div class="znz-know-row">
									<select
										class="znz-select"
										value={line.presetId}
										onchange={(e) =>
											updateKnowledgeLine(line.id, {
												presetId: (e.target as HTMLSelectElement).value
											})}
									>
										{#each ZNZ_KNOWLEDGE_PRESETS as opt}
											<option value={opt.id}>{opt.label}</option>
										{/each}
									</select>
									<input
										class="znz-input znz-input-flex"
										type="text"
										placeholder="Detail (e.g. science subject)"
										value={line.detail}
										oninput={(e) =>
											updateKnowledgeLine(line.id, { detail: (e.target as HTMLInputElement).value })}
									/>
									<div class="znz-stepper">
										<button type="button" class="znz-stepper-btn" onclick={() => bumpKnowledgeRank(line.id, -1)}>−</button>
										<span class="znz-rank">{line.rank}</span>
										<button type="button" class="znz-stepper-btn" onclick={() => bumpKnowledgeRank(line.id, 1)}>+</button>
									</div>
									<button type="button" class="znz-icon-btn" onclick={() => removeKnowledgeLine(line.id)} aria-label="Remove knowledge">×</button>
								</div>
							</div>
						{/each}
						<button type="button" class="znz-btn znz-btn-ghost znz-btn-small" onclick={addKnowledgeLine}>+ Add knowledge</button>
					{/if}

					<h2 class="znz-subtitle znz-divider">Custom skills ({ZNZ_ATTR_LABELS[attrStep]})</h2>
					<p class="znz-hint">Optional. Name and describe each custom skill for this attribute.</p>
					{#each wizard.customSkills.filter((c) => c.attribute === attrStep) as c}
						<div class="znz-custom-card">
							<div class="znz-custom-fields">
								<input
									class="znz-input"
									type="text"
									placeholder="Skill name"
									value={c.label}
									oninput={(e) =>
										updateCustomSkill(c.id, { label: (e.target as HTMLInputElement).value })}
								/>
								<input
									class="znz-input"
									type="text"
									placeholder="Description"
									value={c.description}
									oninput={(e) =>
										updateCustomSkill(c.id, { description: (e.target as HTMLInputElement).value })}
								/>
							</div>
							<div class="znz-custom-actions">
								<div class="znz-stepper">
									<button type="button" class="znz-stepper-btn" onclick={() => bumpCustomSkill(c.id, -1)}>−</button>
									<span class="znz-rank">{c.rank}</span>
									<button type="button" class="znz-stepper-btn" onclick={() => bumpCustomSkill(c.id, 1)}>+</button>
								</div>
								<button type="button" class="znz-icon-btn" onclick={() => removeCustomSkill(c.id)} aria-label="Remove custom skill">×</button>
							</div>
						</div>
					{/each}
					<button type="button" class="znz-btn znz-btn-ghost znz-btn-small" onclick={() => addCustomSkill(attrStep)}>+ Add custom skill</button>

					<p class="znz-pool-foot">Pool {spent} / {pool} spent</p>
				{:else if wizard.step === 6}
					<p class="znz-hint">Pick <strong>one</strong> starting ability for this survivor.</p>
					<ul class="znz-ability-pick">
						{#each ZNZ_STARTING_ABILITIES as ab}
							<li>
								<label class="znz-ability-label">
									<input
										type="radio"
										name="znz-ability"
										value={ab.id}
										checked={wizard.startingAbilityId === ab.id}
										onchange={() => {
											if (!wizard) return;
											wizard = { ...wizard, startingAbilityId: ab.id };
										}}
									/>
									<span class="znz-ability-name">{ab.label}</span>
									<span class="znz-ability-cost">{ab.costText}</span>
									<span class="znz-ability-desc">{ab.description}</span>
								</label>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="znz-wizard-footer">
				<button type="button" class="znz-btn znz-btn-ghost" onclick={cancelToEmpty}>Cancel</button>
				<div class="znz-wizard-nav">
					{#if wizard.step > 1}
						<button type="button" class="znz-btn znz-btn-ghost" onclick={wizardBack}>Back</button>
					{/if}
					{#if wizard.step < 6}
						<button type="button" class="znz-btn znz-btn-primary" onclick={wizardNext}>Next</button>
					{:else}
						<button type="button" class="znz-btn znz-btn-primary" onclick={finishWizard}>Finish</button>
					{/if}
				</div>
			</div>
		</div>
	{:else if mode === 'sheet' && character}
		{@const caps = znzDerivedCaps(character.attributes)}
		<div class="znz-sheet">
			<section class="znz-summary">
				<div class="znz-summary-name">
					<label class="znz-field-label" for="znz-sheet-name">Name</label>
					<input
						id="znz-sheet-name"
						class="znz-input"
						type="text"
						value={character.name}
						oninput={(e) =>
							patchCharacter((c) => ({ ...c, name: (e.target as HTMLInputElement).value }))}
					/>
				</div>
				<div class="znz-summary-stats">
					<div class="znz-stat-block">
						<span class="znz-stat-label">Health (current / max)</span>
						<div class="znz-current-max-row">
							<input
								class="znz-input znz-input-stat"
								type="number"
								min="0"
								value={character.resources.health.value}
								oninput={(e) => {
									const value = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
									patchCharacter((c) => ({
										...c,
										resources: {
											...c.resources,
											health: {
												...c.resources.health,
												value: Math.min(value, c.resources.health.max)
											}
										}
									}));
								}}
							/>
							<span class="znz-current-max-sep">/</span>
							<input
								class="znz-input znz-input-stat"
								type="number"
								min="0"
								value={character.resources.health.max}
								oninput={(e) => {
									const max = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
									patchCharacter((c) => ({
										...c,
										resources: {
											...c.resources,
											health: { max, value: Math.min(c.resources.health.value, max) }
										}
									}));
								}}
							/>
						</div>
					</div>
					<div class="znz-stat-block">
						<span class="znz-stat-label">AP (current / max)</span>
						<div class="znz-current-max-row">
							<input
								class="znz-input znz-input-stat"
								type="number"
								min="0"
								value={character.resources.actionPoints.value}
								oninput={(e) => {
									const value = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
									patchCharacter((c) => ({
										...c,
										resources: {
											...c.resources,
											actionPoints: {
												...c.resources.actionPoints,
												value: Math.min(value, c.resources.actionPoints.max)
											}
										}
									}));
								}}
							/>
							<span class="znz-current-max-sep">/</span>
							<input
								class="znz-input znz-input-stat"
								type="number"
								min="0"
								value={character.resources.actionPoints.max}
								oninput={(e) => {
									const max = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
									patchCharacter((c) => ({
										...c,
										resources: {
											...c.resources,
											actionPoints: { max, value: Math.min(c.resources.actionPoints.value, max) }
										}
									}));
								}}
							/>
						</div>
					</div>
					<div class="znz-stat-block">
						<span class="znz-stat-label">Movement</span>
						<input
							class="znz-input znz-input-stat"
							type="number"
							min="0"
							value={character.resources.movement}
							oninput={(e) => {
								const movement = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
								patchCharacter((c) => ({
									...c,
									resources: { ...c.resources, movement }
								}));
							}}
						/>
					</div>
					<div class="znz-stat-block znz-stat-ref">
						<span class="znz-stat-label">From attributes</span>
						<span class="znz-ref-line">Health {caps.maxHealth}</span>
						<span class="znz-ref-line">AP {caps.maxAp}</span>
						<span class="znz-ref-line">Move {caps.movement}</span>
					</div>
				</div>
			</section>

			<section class="znz-skills-block">
				<h2 class="znz-subtitle">Attributes and skills</h2>
				<p class="znz-hint">Each attribute includes all skills in one indented list.</p>
				{#each ATTR_KEYS as k (k)}
					<div class="znz-attr-group">
						<div class="znz-attr-group-head">
							<h3 class="znz-col-title">{ZNZ_ATTR_LABELS[k]}</h3>
							<input
								class="znz-input znz-input-number"
								type="number"
								min={ATTR_MIN}
								max={znzAttrHtmlMax(character.attributes, k)}
								step="1"
								value={znzAttrCoerce(character.attributes[k])}
								use:znzSuppressWheelWhenFocused
								oninput={(e) => {
									const raw = Number((e.target as HTMLInputElement).value);
									patchCharacter((c) => ({
										...c,
										attributes: applyZnzAttributeChange(k, raw, c.attributes)
									}));
								}}
							/>
						</div>
						<p class="znz-attr-blurb small">{ZNZ_ATTR_BLURBS[k]}</p>
						<ul class="znz-skill-indent-list">
							{#each ZNZ_CORE_SKILLS[k] as s}
								<li class="znz-indent-row">
									<div class="znz-indent-skill-text">
										<label class="znz-edit-label" for={`sk-${s.id}`}>{s.label}</label>
										<p class="znz-skill-desc small">{s.description}</p>
									</div>
									<input
										id={`sk-${s.id}`}
										class="znz-input znz-input-number"
										type="number"
										min="0"
										max="99"
										value={character.skills[s.id] ?? 0}
										oninput={(e) => {
											const v = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
											patchCharacter((c) => ({
												...c,
												skills: { ...c.skills, [s.id]: v }
											}));
										}}
									/>
								</li>
							{/each}
							{#each ZNZ_ADDON_PRESETS.filter((a) => a.attribute === k) as a}
								<li class="znz-indent-row">
									<div class="znz-indent-skill-text">
										<label class="znz-edit-label" for={`ad-${a.id}`}>{a.label}</label>
										<p class="znz-skill-desc small">{a.description}</p>
									</div>
									<input
										id={`ad-${a.id}`}
										class="znz-input znz-input-number"
										type="number"
										min="0"
										max="99"
										value={character.addonRanks[a.id] ?? 0}
										oninput={(e) => {
											const v = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
											patchCharacter((c) => ({
												...c,
												addonRanks: { ...c.addonRanks, [a.id]: v }
											}));
										}}
									/>
								</li>
							{/each}
							{#if k === 'mind'}
								{#each character.knowledgeLines as line, i}
									<li class="znz-indent-row">
										<div class="znz-indent-skill-text">
											<span class="znz-edit-label">Knowledge {i + 1}</span>
											<div class="znz-know-inline">
												<select
													class="znz-select"
													value={line.presetId}
													onchange={(e) =>
														patchCharacter((c) => ({
															...c,
															knowledgeLines: c.knowledgeLines.map((x) =>
																x.id === line.id
																	? { ...x, presetId: (e.target as HTMLSelectElement).value }
																	: x
															)
														}))}
												>
													{#each ZNZ_KNOWLEDGE_PRESETS as opt}
														<option value={opt.id}>{opt.label}</option>
													{/each}
												</select>
												<input
													class="znz-input"
													type="text"
													placeholder="Detail"
													value={line.detail}
													oninput={(e) =>
														patchCharacter((c) => ({
															...c,
															knowledgeLines: c.knowledgeLines.map((x) =>
																x.id === line.id
																	? { ...x, detail: (e.target as HTMLInputElement).value }
																	: x
															)
														}))}
												/>
											</div>
										</div>
										<input
											class="znz-input znz-input-number"
											type="number"
											min="0"
											value={line.rank}
											oninput={(e) =>
												patchCharacter((c) => ({
													...c,
													knowledgeLines: c.knowledgeLines.map((x) =>
														x.id === line.id
															? {
																	...x,
																	rank: Math.max(
																		0,
																		Number((e.target as HTMLInputElement).value) || 0
																	)
																}
															: x
													)
												}))}
										/>
									</li>
								{/each}
							{/if}
							{#each character.customSkills.filter((c) => c.attribute === k) as c}
								<li class="znz-indent-row">
									<div class="znz-indent-skill-text">
										<input
											class="znz-input"
											type="text"
											placeholder="Custom skill name"
											value={c.label}
											oninput={(e) =>
												patchCharacter((ch) => ({
													...ch,
													customSkills: ch.customSkills.map((x) =>
														x.id === c.id ? { ...x, label: (e.target as HTMLInputElement).value } : x
													)
												}))}
										/>
										<input
											class="znz-input"
											type="text"
											placeholder="Description"
											value={c.description}
											oninput={(e) =>
												patchCharacter((ch) => ({
													...ch,
													customSkills: ch.customSkills.map((x) =>
														x.id === c.id
															? { ...x, description: (e.target as HTMLInputElement).value }
															: x
													)
												}))}
										/>
									</div>
									<input
										class="znz-input znz-input-number"
										type="number"
										min="0"
										value={c.rank}
										oninput={(e) =>
											patchCharacter((ch) => ({
												...ch,
												customSkills: ch.customSkills.map((x) =>
													x.id === c.id
														? {
																...x,
																rank: Math.max(
																	0,
																	Number((e.target as HTMLInputElement).value) || 0
																)
															}
														: x
												)
											}))}
									/>
								</li>
							{/each}
						</ul>
						<div class="znz-skill-add-row">
							{#if k === 'mind'}
								<button
									type="button"
									class="znz-btn znz-btn-ghost znz-btn-small"
									onclick={() =>
										patchCharacter((c) => ({
											...c,
											knowledgeLines: [
												...c.knowledgeLines,
												{
													id: znzNewLineId('know'),
													presetId: ZNZ_KNOWLEDGE_PRESETS[0]?.id ?? 'engineering',
													detail: '',
													rank: 0
												}
											]
										}))}>+ Add knowledge</button>
							{/if}
							<button
								type="button"
								class="znz-btn znz-btn-ghost znz-btn-small"
								onclick={() =>
									patchCharacter((ch) => ({
										...ch,
										customSkills: [
											...ch.customSkills,
											{
												id: znzNewLineId('custom'),
												label: '',
												description: '',
												attribute: k,
												rank: 0
											}
										]
									}))}>+ Add custom</button>
						</div>
					</div>
				{/each}
			</section>

			<section class="znz-abilities-sheet">
				<h2 class="znz-subtitle">Abilities</h2>

				<h3 class="znz-ability-section-title">Starting ability</h3>
				<p class="znz-hint">
					Chosen during creation; you can change it here. Export includes this id for Foundry (additional
					abilities are listed separately in JSON for reference).
				</p>
				<div class="znz-ability-select-row">
					<select
						class="znz-select znz-select-wide"
						value={character.startingAbilityId ?? ''}
						onchange={(e) => {
							const v = (e.target as HTMLSelectElement).value || null;
							patchCharacter((c) => ({
								...c,
								startingAbilityId: v,
								additionalAbilityIds: (c.additionalAbilityIds ?? []).filter((x) => x !== v)
							}));
						}}
					>
						<option value="">— None —</option>
						{#each ZNZ_STARTING_ABILITIES as ab}
							<option value={ab.id}>{ab.label}</option>
						{/each}
					</select>
				</div>
				{#if chosenAbility}
					<div class="znz-selected-ability">
						<span class="znz-ability-name">{chosenAbility.label}</span>
						<span class="znz-ability-cost">{chosenAbility.costText}</span>
						<p class="znz-ability-desc">{chosenAbility.description}</p>
					</div>
				{:else}
					<p class="znz-hint">No starting ability selected.</p>
				{/if}

				<h3 class="znz-ability-section-title">Additional abilities</h3>
				<p class="znz-hint">
					Optional extras (e.g. progression or homebrew). Pick from the same list; duplicates and the
					starting ability are excluded automatically.
				</p>
				{#if (character.additionalAbilityIds ?? []).length > 0}
					<ul class="znz-additional-ability-list">
						{#each character.additionalAbilityIds as aid (aid)}
							{@const ab = ZNZ_STARTING_ABILITIES.find((x) => x.id === aid)}
							{#if ab}
								<li class="znz-additional-ability-item">
									<div class="znz-selected-ability znz-selected-ability--compact">
										<span class="znz-ability-name">{ab.label}</span>
										<span class="znz-ability-cost">{ab.costText}</span>
										<p class="znz-ability-desc">{ab.description}</p>
									</div>
									<button
										type="button"
										class="znz-btn znz-btn-ghost znz-btn-small"
										onclick={() => removeAdditionalAbility(aid)}>Remove</button>
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
				{#if availableExtraAbilities.length > 0}
					<div class="znz-add-ability-row">
						<label class="znz-field-label znz-sr-only" for="znz-add-ability">Add ability</label>
						<select
							id="znz-add-ability"
							class="znz-select znz-select-wide"
							value=""
							onchange={(e) => {
								const el = e.target as HTMLSelectElement;
								const v = el.value;
								if (v) addAdditionalAbility(v);
								el.value = '';
							}}
						>
							<option value="">+ Add ability…</option>
							{#each availableExtraAbilities as ab}
								<option value={ab.id}>{ab.label}</option>
							{/each}
						</select>
					</div>
				{:else if (character.additionalAbilityIds ?? []).length > 0}
					<p class="znz-hint small">All other abilities from this list are already on the character.</p>
				{/if}
			</section>

			<section class="znz-meta-row">
				<label class="znz-field-label" for="znz-xp">XP</label>
				<input
					id="znz-xp"
					class="znz-input znz-input-number"
					type="number"
					min="0"
					value={character.xp}
					oninput={(e) =>
						patchCharacter((c) => ({
							...c,
							xp: Math.max(0, Number((e.target as HTMLInputElement).value) || 0)
						}))}
				/>
			</section>

			<label class="znz-field-label" for="znz-bio">Biography / notes</label>
			<textarea
				id="znz-bio"
				class="znz-textarea"
				rows="4"
				value={character.biography}
				oninput={(e) =>
					patchCharacter((c) => ({
						...c,
						biography: (e.target as HTMLTextAreaElement).value
					}))}
			></textarea>

			<p class="znz-autosave">Character is saved automatically on this device ({STORAGE_KEY_ZNZ}).</p>
		</div>
	{/if}
</div>

<style>
	.znz-page {
		max-width: 64rem;
		margin: 0 auto;
		padding: 0 0 2rem 0;
		color: #e8e6e3;
		background: #0c0e0d;
		border-radius: 12px;
		padding: 1rem 1.25rem 2rem;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
	}

	.znz-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.znz-back {
		color: #7cfd8a;
		text-decoration: none;
		font-weight: 500;
	}
	.znz-back:hover {
		text-decoration: underline;
	}

	.znz-toolbar-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.znz-toast {
		background: #1e3d2a;
		border: 1px solid #3a6b4a;
		color: #c8f5d0;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.znz-empty {
		min-height: calc(100vh - 8rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
	}

	.znz-empty-card {
		text-align: center;
		max-width: 26rem;
		padding: 2.5rem 2rem;
		background: linear-gradient(160deg, #141a16 0%, #1a1418 100%);
		border: 1px solid #3d2a32;
		border-radius: 12px;
		box-shadow: 0 0 0 1px rgba(124, 253, 138, 0.08), 0 20px 50px rgba(0, 0, 0, 0.45);
	}

	.znz-title {
		font-family: ui-monospace, monospace;
		font-size: 1.75rem;
		margin: 0 0 0.5rem 0;
		letter-spacing: 0.06em;
		color: #f2efe9;
		text-transform: uppercase;
	}

	.znz-tagline {
		margin: 0 0 1.75rem 0;
		color: #a8a39a;
		line-height: 1.5;
		font-size: 0.95rem;
	}

	.znz-btn {
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid transparent;
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
	}
	.znz-btn-primary {
		background: #7cfd8a;
		color: #0f160f;
		border-color: #5bdc6f;
	}
	.znz-btn-primary:hover {
		filter: brightness(1.05);
	}
	.znz-btn-ghost {
		background: transparent;
		color: #d5d0c8;
		border-color: #4a4540;
	}
	.znz-btn-ghost:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.znz-btn-danger {
		background: transparent;
		color: #ff8b8b;
		border-color: #6b3030;
	}
	.znz-btn-danger:hover {
		background: rgba(255, 80, 80, 0.08);
	}
	.znz-btn-small {
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
	}
	.znz-btn-build {
		font-size: 1rem;
		padding: 0.65rem 1.5rem;
	}

	.znz-wizard {
		background: #121610;
		border: 1px solid #2a332b;
		border-radius: 10px;
		padding: 1.25rem 1.5rem 1rem;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.znz-wizard-head {
		margin-bottom: 1rem;
		border-bottom: 1px solid #2a332b;
		padding-bottom: 0.75rem;
	}

	.znz-step-label {
		margin: 0.25rem 0 0 0;
		color: #9a958c;
		font-size: 0.9rem;
	}

	.znz-wizard-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.znz-attribute-header {
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
	}
	.znz-attribute-title {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		color: #dfffe3;
	}

	.znz-wizard-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid #2a332b;
	}

	.znz-wizard-nav {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.znz-field-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #b5b0a7;
		margin-bottom: 0.25rem;
		display: block;
	}

	.znz-input,
	.znz-textarea,
	.znz-select {
		background: #0c0f0d;
		border: 1px solid #3a403b;
		color: #f0ebe4;
		border-radius: 6px;
		padding: 0.45rem 0.55rem;
		font-size: 0.95rem;
	}
	.znz-input:focus,
	.znz-textarea:focus,
	.znz-select:focus {
		outline: none;
		border-color: #7cfd8a;
		box-shadow: 0 0 0 1px rgba(124, 253, 138, 0.25);
	}
	.znz-input-number {
		max-width: 4rem;
		text-align: center;
	}
	.znz-input-flex {
		flex: 1;
		min-width: 0;
	}
	.znz-textarea {
		width: 100%;
		resize: vertical;
	}

	.znz-hint {
		margin: 0;
		color: #9a958c;
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.znz-attr-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	@media (max-width: 720px) {
		.znz-attr-grid {
			grid-template-columns: 1fr;
		}
	}

	.znz-attr-box {
		background: #0f1411;
		border: 1px solid #2f3831;
		border-radius: 8px;
		padding: 0.75rem;
	}
	.znz-attr-title {
		font-weight: 700;
		color: #dfffe3;
		margin-bottom: 0.35rem;
	}
	.znz-attr-blurb {
		font-size: 0.78rem;
		color: #8f8a82;
		margin: 0 0 0.5rem 0;
		line-height: 1.35;
	}
	.znz-attr-blurb.small {
		font-size: 0.72rem;
		margin-top: 0.35rem;
	}

	.znz-derived-panel {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding: 0.75rem;
		background: #0a0d0b;
		border: 1px dashed #354038;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.znz-derived-panel > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.znz-derived-k {
		color: #8c877e;
	}
	.znz-derived-v {
		font-family: ui-monospace, monospace;
		color: #b4ffbf;
		font-weight: 600;
	}

	.znz-subtitle {
		margin: 0.5rem 0 0.35rem 0;
		font-size: 0.95rem;
		color: #c9c4bc;
	}
	.znz-mini-title {
		margin: 0.35rem 0;
		font-size: 0.8rem;
		color: #9a968f;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.znz-divider {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid #2a332b;
	}

	.znz-skill-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.znz-skill-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.65rem;
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
	}
	.znz-skill-text {
		min-width: 0;
	}
	.znz-skill-name {
		display: block;
		font-weight: 600;
		color: #e4dfd7;
	}
	.znz-skill-desc {
		display: block;
		font-size: 0.78rem;
		color: #8f8a82;
		margin-top: 0.2rem;
		line-height: 1.35;
	}
	.znz-skill-desc.small {
		font-size: 0.72rem;
		margin: 0.15rem 0 0.35rem 0;
	}

	.znz-stepper {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.znz-stepper-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #1a1f1c;
		color: #e8e3db;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
	}
	.znz-stepper-btn:hover {
		border-color: #7cfd8a;
		color: #7cfd8a;
	}
	.znz-rank {
		min-width: 1.5rem;
		text-align: center;
		font-family: ui-monospace, monospace;
		font-weight: 700;
		color: #b4ffbf;
	}

	.znz-know-card {
		margin-bottom: 0.5rem;
	}
	.znz-know-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
	}

	.znz-custom-card {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
		margin-bottom: 0.5rem;
	}
	.znz-custom-fields {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.znz-custom-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.znz-icon-btn {
		background: transparent;
		border: none;
		color: #c77;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0 0.25rem;
	}
	.znz-icon-btn:hover {
		color: #f99;
	}

	.znz-pool-foot {
		margin: 0.75rem 0 0 0;
		font-size: 0.8rem;
		color: #7a756d;
		font-family: ui-monospace, monospace;
	}

	.znz-ability-pick {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.znz-ability-label {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		gap: 0.15rem 0.5rem;
		padding: 0.6rem 0.75rem;
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
		cursor: pointer;
		align-items: baseline;
	}
	.znz-ability-label input {
		grid-row: 1 / span 2;
		accent-color: #7cfd8a;
	}
	.znz-ability-name {
		font-weight: 700;
		color: #e8e3db;
	}
	.znz-ability-cost {
		font-size: 0.75rem;
		color: #9a968f;
		grid-column: 2;
	}
	.znz-ability-desc {
		grid-column: 2;
		margin: 0;
		font-size: 0.78rem;
		color: #8f8a82;
		line-height: 1.35;
	}

	.znz-sheet {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.znz-summary {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: #121610;
		border: 1px solid #2a332b;
		border-radius: 10px;
	}
	.znz-summary-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.75rem;
	}
	.znz-stat-block {
		background: #0f1411;
		border: 1px solid #2c3530;
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.znz-stat-label {
		font-size: 0.75rem;
		color: #9a968f;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.znz-stat-sub {
		font-size: 0.7rem;
		color: #7a756d;
	}
	.znz-input-stat {
		max-width: 6rem;
	}
	.znz-current-max-row {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.znz-current-max-sep {
		color: #8d887f;
		font-weight: 700;
	}
	.znz-stat-ref {
		border-style: dashed;
	}
	.znz-ref-line {
		font-size: 0.8rem;
		color: #8c877e;
		font-family: ui-monospace, monospace;
	}

	.sheet-attrs {
		margin-top: 0.25rem;
	}

	.znz-skills-block {
		background: #121610;
		border: 1px solid #2a332b;
		border-radius: 10px;
		padding: 1rem;
	}
	.znz-attr-group {
		padding: 0.65rem 0.75rem;
		border: 1px solid #263029;
		border-radius: 8px;
		background: #0f1411;
		margin-bottom: 0.75rem;
	}
	.znz-attr-group:last-child {
		margin-bottom: 0;
	}
	.znz-attr-group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.znz-skill-indent-list {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0 0 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.znz-indent-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.znz-indent-skill-text {
		flex: 1;
		min-width: 0;
	}
	.znz-know-inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.znz-skill-add-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding-left: 1rem;
		margin-top: 0.6rem;
	}

	.znz-three-col {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	@media (max-width: 960px) {
		.znz-three-col {
			grid-template-columns: 1fr;
		}
	}

	.znz-col {
		background: #121610;
		border: 1px solid #2a332b;
		border-radius: 10px;
		padding: 0.75rem 1rem;
		min-width: 0;
	}
	.znz-col-title {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: #dfffe3;
	}

	.znz-edit-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.znz-edit-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #d8d3cb;
	}

	.znz-know-edit,
	.znz-custom-edit {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #222924;
	}

	.znz-abilities-sheet {
		background: #121610;
		border: 1px solid #2a332b;
		border-radius: 10px;
		padding: 1rem;
	}
	.znz-ability-select-row {
		margin-bottom: 0.75rem;
	}
	.znz-select-wide {
		width: 100%;
		max-width: 24rem;
	}
	.znz-ability-ref-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.znz-selected-ability {
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid #4a8f57;
		background: #0f1411;
	}
	.znz-ability-section-title {
		margin: 1.15rem 0 0.35rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: #cfe8d3;
	}
	.znz-abilities-sheet > h3.znz-ability-section-title:first-of-type {
		margin-top: 0;
	}
	.znz-additional-ability-list {
		list-style: none;
		margin: 0 0 0.65rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.znz-additional-ability-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.znz-additional-ability-item .znz-selected-ability--compact {
		flex: 1;
		min-width: 12rem;
	}
	.znz-selected-ability--compact {
		padding: 0.4rem 0.55rem;
		border-color: #3d6b46;
	}
	.znz-selected-ability--compact .znz-ability-desc {
		margin-bottom: 0;
		font-size: 0.82rem;
	}
	.znz-add-ability-row {
		margin-top: 0.25rem;
	}
	.znz-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.znz-ability-ref-list li {
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		border: 1px solid #2c3530;
		background: #0f1411;
	}
	.znz-ability-active {
		border-color: #4a8f57;
		box-shadow: 0 0 0 1px rgba(124, 253, 138, 0.15);
	}

	.znz-meta-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.znz-autosave {
		font-size: 0.78rem;
		color: #6f6a63;
		margin: 0;
	}
</style>
