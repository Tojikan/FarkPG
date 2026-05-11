import {
	type ZnzAttrKey,
	ZNZ_CORE_SKILLS,
	ZNZ_CORE_SKILL_IDS,
	ZNZ_ADDON_PRESETS,
	ZNZ_STARTING_ABILITIES,
	znzSkillPoolSize,
	znzKnowledgeLabel
} from './definitions.js';

export { znzSkillPoolSize } from './definitions.js';

export const STORAGE_KEY_ZNZ = 'farkpg-character-znz';

export const ZNZ_EXPORT_FORMAT_ID = 'farkpg-znz-character-export';
export const ZNZ_EXPORT_FORMAT_VERSION = 1;

export type ZnzWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Total point cost to raise a skill from 0 to `level` (1+2+...+level). */
export function znzTriangularCostToLevel(level: number): number {
	const L = Math.max(0, Math.floor(level));
	return (L * (L + 1)) / 2;
}

export interface ZnzKnowledgeLine {
	id: string;
	presetId: string;
	detail: string;
	rank: number;
}

export interface ZnzCustomSkillLine {
	id: string;
	label: string;
	description: string;
	attribute: ZnzAttrKey;
	rank: number;
}

/** Runtime character (sheet + export source). */
export interface ZnzCharacter {
	name: string;
	/** Notes / backstory for Foundry biography import. */
	biography: string;
	attributes: Record<ZnzAttrKey, number>;
	/** Core skills only (Foundry keys). */
	skills: Record<string, number>;
	knowledgeLines: ZnzKnowledgeLine[];
	addonRanks: Record<string, number>;
	customSkills: ZnzCustomSkillLine[];
	startingAbilityId: string | null;
	/** Extra abilities beyond the starting pick (sheet); ids from the ZnZ starting-ability catalog only. */
	additionalAbilityIds: string[];
	resources: {
		health: { value: number; max: number };
		actionPoints: { value: number; max: number };
		movement: number;
	};
	xp: number;
}

export interface ZnzWizardDraft {
	step: ZnzWizardStep;
	name: string;
	biography: string;
	attributes: Record<ZnzAttrKey, number>;
	skills: Record<string, number>;
	addonRanks: Record<string, number>;
	knowledgeLines: ZnzKnowledgeLine[];
	customSkills: ZnzCustomSkillLine[];
	startingAbilityId: string | null;
}

export interface ZnzPersistedV1 {
	version: 1;
	mode: 'empty' | 'wizard' | 'sheet';
	wizard: ZnzWizardDraft | null;
	character: ZnzCharacter | null;
}

/** Derived from attributes; used in wizard and to initialize resources. */
const VALID_ABILITY_IDS = new Set(ZNZ_STARTING_ABILITIES.map((a) => a.id));

/**
 * Ordered list of extra ability ids: known ids only, no duplicates, never includes `startingId`.
 */
function znzSanitizeAdditionalAbilityIds(raw: unknown, startingId: string | null): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	if (startingId && VALID_ABILITY_IDS.has(startingId)) seen.add(startingId);
	if (!Array.isArray(raw)) return out;
	for (const x of raw) {
		if (typeof x !== 'string' || !VALID_ABILITY_IDS.has(x) || seen.has(x)) continue;
		seen.add(x);
		out.push(x);
	}
	return out;
}

export function znzDerivedCaps(attributes: Record<ZnzAttrKey, number>): {
	maxHealth: number;
	maxAp: number;
	movement: number;
} {
	const body = attributes.body ?? 3;
	const adroit = attributes.adroit ?? 3;
	const mind = attributes.mind ?? 3;
	return {
		maxHealth: 10000 + (body - 3) * 2000,
		movement: 20 + (adroit - 3) * 5,
		maxAp: 18 + (mind - 3) * 2
	};
}

export function createEmptyCoreSkills(): Record<string, number> {
	const o: Record<string, number> = {};
	for (const id of ZNZ_CORE_SKILL_IDS) o[id] = 0;
	return o;
}

export function createEmptyZnzCharacter(): ZnzCharacter {
	const attrs = { body: 3, adroit: 3, mind: 3 } as Record<ZnzAttrKey, number>;
	const caps = znzDerivedCaps(attrs);
	return {
		name: '',
		biography: '',
		attributes: attrs,
		skills: createEmptyCoreSkills(),
		knowledgeLines: [],
		addonRanks: {},
		customSkills: [],
		startingAbilityId: null,
		additionalAbilityIds: [],
		resources: {
			health: { value: caps.maxHealth, max: caps.maxHealth },
			actionPoints: { value: caps.maxAp, max: caps.maxAp },
			movement: caps.movement
		},
		xp: 0
	};
}

export function createInitialWizardDraft(): ZnzWizardDraft {
	const c = createEmptyZnzCharacter();
	return {
		step: 1,
		name: '',
		biography: '',
		attributes: { ...c.attributes },
		skills: { ...c.skills },
		addonRanks: {},
		knowledgeLines: [],
		customSkills: [],
		startingAbilityId: null
	};
}

export function draftToCharacter(d: ZnzWizardDraft): ZnzCharacter {
	const caps = znzDerivedCaps(d.attributes);
	return {
		name: d.name.trim(),
		biography: d.biography,
		attributes: { ...d.attributes },
		skills: { ...d.skills },
		knowledgeLines: d.knowledgeLines.map((k) => ({ ...k })),
		addonRanks: { ...d.addonRanks },
		customSkills: d.customSkills.map((c) => ({ ...c })),
		startingAbilityId: d.startingAbilityId,
		additionalAbilityIds: [],
		resources: {
			health: { value: caps.maxHealth, max: caps.maxHealth },
			actionPoints: { value: caps.maxAp, max: caps.maxAp },
			movement: caps.movement
		},
		xp: 0
	};
}

export type ZnzSkillSpendSource = Pick<ZnzCharacter, 'skills' | 'knowledgeLines' | 'addonRanks' | 'customSkills'>;

/** Spend for one attribute pool (mind includes all knowledge lines). */
export function znzPointsSpentForAttribute(char: ZnzSkillSpendSource, attr: ZnzAttrKey): number {
	let spent = 0;
	for (const s of ZNZ_CORE_SKILLS[attr]) {
		spent += znzTriangularCostToLevel(char.skills[s.id] ?? 0);
	}
	if (attr === 'mind') {
		for (const line of char.knowledgeLines) {
			spent += znzTriangularCostToLevel(line.rank);
		}
	}
	for (const [addonId, r] of Object.entries(char.addonRanks)) {
		if (!r) continue;
		const preset = ZNZ_ADDON_PRESETS.find((a) => a.id === addonId);
		if (preset?.attribute === attr) spent += znzTriangularCostToLevel(r);
	}
	for (const c of char.customSkills) {
		if (c.attribute === attr) spent += znzTriangularCostToLevel(c.rank);
	}
	return spent;
}

export function znzRemainingSkillPoints(char: ZnzSkillSpendSource, attr: ZnzAttrKey): number {
	return znzSkillPoolSize(attr) - znzPointsSpentForAttribute(char, attr);
}

let _idSeq = 0;
export function znzNewLineId(prefix: string): string {
	_idSeq += 1;
	return `${prefix}-${Date.now()}-${_idSeq}`;
}

/** Export payload for clipboard / Foundry import. */
export function znzBuildExportJson(char: ZnzCharacter): string {
	const addonSkills: {
		key: string;
		label: string;
		description: string;
		attribute: ZnzAttrKey;
		rank: number;
		knowledgePreset?: string;
		knowledgeDetail?: string;
	}[] = [];

	for (const [id, rank] of Object.entries(char.addonRanks)) {
		if (!rank) continue;
		const p = ZNZ_ADDON_PRESETS.find((a) => a.id === id);
		if (!p) continue;
		addonSkills.push({
			key: id,
			label: p.label,
			description: p.description,
			attribute: p.attribute,
			rank
		});
	}

	for (const line of char.knowledgeLines) {
		if (!line.rank) continue;
		addonSkills.push({
			key: 'knowledge',
			label: znzKnowledgeLabel(line.presetId, line.detail),
			description: `Knowledge: ${znzKnowledgeLabel(line.presetId, line.detail)}`,
			attribute: 'mind',
			rank: line.rank,
			knowledgePreset: line.presetId,
			knowledgeDetail: line.detail?.trim() || undefined
		});
	}

	const customSkills = char.customSkills
		.filter((c) => c.rank > 0 || c.label.trim())
		.map((c) => ({
			id: c.id,
			label: c.label,
			description: c.description,
			attribute: c.attribute,
			rank: c.rank
		}));

	const payload = {
		formatId: ZNZ_EXPORT_FORMAT_ID,
		formatVersion: ZNZ_EXPORT_FORMAT_VERSION,
		systemId: 'farkpg-znz',
		name: char.name,
		biography: char.biography,
		attributes: { ...char.attributes },
		skills: { ...char.skills },
		addonSkills,
		customSkills,
		startingAbilityId: char.startingAbilityId,
		additionalAbilityIds: [...(char.additionalAbilityIds ?? [])],
		resources: {
			health: { ...char.resources.health },
			actionPoints: { ...char.resources.actionPoints },
			movement: char.resources.movement
		},
		xp: char.xp
	};

	return JSON.stringify(payload, null, 2);
}

export function znzNormalizeCharacter(raw: Partial<ZnzCharacter> | null): ZnzCharacter | null {
	if (!raw?.attributes) return null;
	const empty = createEmptyZnzCharacter();
	const attrs = { ...empty.attributes, ...raw.attributes } as Record<ZnzAttrKey, number>;
	const skills = { ...empty.skills, ...raw.skills };
	const caps = znzDerivedCaps(attrs);
	const res = raw.resources ?? empty.resources;
	const startRaw = raw.startingAbilityId;
	const startingAbilityId =
		typeof startRaw === 'string' && VALID_ABILITY_IDS.has(startRaw) ? startRaw : null;
	return {
		name: typeof raw.name === 'string' ? raw.name : '',
		biography: typeof raw.biography === 'string' ? raw.biography : '',
		attributes: attrs,
		skills,
		knowledgeLines: Array.isArray(raw.knowledgeLines) ? raw.knowledgeLines : [],
		addonRanks: raw.addonRanks && typeof raw.addonRanks === 'object' ? { ...raw.addonRanks } : {},
		customSkills: Array.isArray(raw.customSkills) ? raw.customSkills : [],
		startingAbilityId,
		additionalAbilityIds: znzSanitizeAdditionalAbilityIds(raw.additionalAbilityIds, startingAbilityId),
		resources: {
			health: {
				value: res.health?.value ?? caps.maxHealth,
				max: res.health?.max ?? caps.maxHealth
			},
			actionPoints: {
				value: res.actionPoints?.value ?? caps.maxAp,
				max: res.actionPoints?.max ?? caps.maxAp
			},
			movement: res.movement ?? caps.movement
		},
		xp: typeof raw.xp === 'number' ? raw.xp : 0
	};
}

export function znzNormalizeWizardDraft(raw: Partial<ZnzWizardDraft> | null): ZnzWizardDraft | null {
	if (!raw) return null;
	const base = createInitialWizardDraft();
	return {
		step: ([1, 2, 3, 4, 5, 6].includes(raw.step as number) ? raw.step : 1) as ZnzWizardStep,
		name: typeof raw.name === 'string' ? raw.name : '',
		biography: typeof raw.biography === 'string' ? raw.biography : '',
		attributes: { ...base.attributes, ...raw.attributes } as Record<ZnzAttrKey, number>,
		skills: { ...base.skills, ...raw.skills },
		addonRanks: raw.addonRanks && typeof raw.addonRanks === 'object' ? { ...raw.addonRanks } : {},
		knowledgeLines: Array.isArray(raw.knowledgeLines) ? raw.knowledgeLines : [],
		customSkills: Array.isArray(raw.customSkills) ? raw.customSkills : [],
		startingAbilityId: raw.startingAbilityId ?? null
	};
}

export function znzLoadPersisted(): ZnzPersistedV1 {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ZNZ) : null;
		if (!raw) return { version: 1, mode: 'empty', wizard: null, character: null };
		const data = JSON.parse(raw) as Partial<ZnzPersistedV1>;
		if (data?.version !== 1) return { version: 1, mode: 'empty', wizard: null, character: null };
		const mode = data.mode === 'wizard' || data.mode === 'sheet' || data.mode === 'empty' ? data.mode : 'empty';
		const character = znzNormalizeCharacter(data.character ?? null);
		const wizard = znzNormalizeWizardDraft(data.wizard ?? null);
		return {
			version: 1,
			mode,
			wizard,
			character
		};
	} catch {
		return { version: 1, mode: 'empty', wizard: null, character: null };
	}
}

export function znzSavePersisted(state: ZnzPersistedV1): void {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_ZNZ, JSON.stringify(state));
		}
	} catch {
		/* ignore */
	}
}
