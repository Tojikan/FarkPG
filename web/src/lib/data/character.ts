import type { Character, Theme } from './types.js';

const SCHEMA_VERSION = 1;
const STORAGE_KEY_BASIC = 'farkpg-character-basic';
const STORAGE_KEY_NEON = 'farkpg-character-neon';

/** Fate max = theme.fateMax + character.bonusFatePoints */
export function getFateMax(character: Character, theme: Theme): number {
	return (theme.fateMax ?? 5) + (character.bonusFatePoints ?? 0);
}

/** Compute health max from theme.healthFromAttribute if set, else use character.health.max or theme.healthMax */
export function getHealthMax(character: Character, theme: Theme): number {
	const rule = theme.healthFromAttribute;
	if (rule) {
		const val = character.attributes[rule.attributeId] ?? 0;
		return rule.baseValue + (val - rule.atStat) * rule.perPoint;
	}
	return character.health?.max ?? theme.healthMax ?? 10;
}

/** Return character with health.max set from attribute (and current clamped). Use before save so JSON has correct max. */
export function syncHealthMaxToCharacter(character: Character, theme: Theme): Character {
	const max = getHealthMax(character, theme);
	const h = character.health ?? { current: 0, max: 0 };
	const current = Math.min(h.current, max);
	return { ...character, health: { current, max } };
}

/** Create an empty character from a theme */
export function createEmptyCharacter(theme: Theme): Character {
	const attributes: Record<string, number> = {};
	for (const a of theme.attributes) {
		attributes[a.id] = a.default;
	}
	const skills: Record<string, Record<string, number>> = {};
	for (const catId of Object.keys(theme.skills)) {
		skills[catId] = {};
		for (const s of theme.skills[catId].skills) {
			skills[catId][s.id] = 0;
		}
	}
	const abilities: Record<string, number> = {};
	for (const ab of theme.abilities) {
		abilities[ab.id] = 0;
	}
	const enhancements: Record<string, number> = {};
	const themeEnh = theme.enhancements ?? [];
	for (const e of themeEnh) {
		enhancements[e.id] = 0;
	}
	const baseFate = (theme as { luckMax?: number }).luckMax ?? theme.fateMax ?? 5;
	const baseChar: Character = {
		name: '',
		notes: '',
		attributes,
		skills,
		abilities,
		...(themeEnh.length > 0 ? { enhancements } : {}),
		points: { ...theme.points },
		health: { current: 0, max: 0 },
		xp: 0,
		bonusFatePoints: 0,
		fate: { current: baseFate, max: baseFate },
		schemaVersion: SCHEMA_VERSION
	};
	const healthMax = getHealthMax(baseChar, theme);
	return { ...baseChar, health: { current: healthMax, max: healthMax } };
}

/** Spent attribute points (defaults count as spent) */
export function getSpentAttributePoints(character: Character, theme: Theme): number {
	let spent = 0;
	for (const a of theme.attributes) {
		spent += character.attributes[a.id] ?? a.default;
	}
	return spent;
}

/** Spent skill points in a category */
export function getSpentSkillPoints(character: Character, categoryId: string): number {
	const cat = character.skills[categoryId];
	if (!cat) return 0;
	let spent = Object.values(cat).reduce((a, b) => a + b, 0);
	const custom = character.custom?.skills?.[categoryId];
	if (custom) spent += custom.reduce((a, c) => a + c.value, 0);
	return spent;
}

/** Spent ability points (includes enhancements when theme has them; same pool) */
export function getSpentAbilityPoints(character: Character, theme: Theme): number {
	let spent = 0;
	for (const ab of theme.abilities) {
		const level = character.abilities[ab.id] ?? 0;
		if (level > 0) spent += ab.cost * (ab.levelable ? level : 1);
	}
	const custom = character.custom?.abilities ?? [];
	for (const c of custom) {
		if ((character.abilities[c.id] ?? 0) > 0) spent += c.cost ?? 1;
	}
	const themeEnh = theme.enhancements ?? [];
	for (const e of themeEnh) {
		const level = (character.enhancements ?? {})[e.id] ?? 0;
		if (level > 0) spent += e.cost * (e.levelable ? level : 1);
	}
	const customEnh = character.custom?.enhancements ?? [];
	for (const c of customEnh) {
		if ((character.enhancements ?? {})[c.id] > 0) spent += c.cost ?? 1;
	}
	return spent;
}

export function getRemainingAttributePoints(character: Character, theme: Theme): number {
	return (character.points.attributes ?? theme.points.attributes) - getSpentAttributePoints(character, theme);
}

export function getRemainingSkillPoints(character: Character, theme: Theme, categoryId: string): number {
	const max = character.points.skills?.[categoryId] ?? theme.points.skills[categoryId] ?? 0;
	return max - getSpentSkillPoints(character, categoryId);
}

export function getRemainingAbilityPoints(character: Character, theme: Theme): number {
	return (character.points.abilities ?? theme.points.abilities) - getSpentAbilityPoints(character, theme);
}

/** Load character from localStorage; merge with empty character so new fields (notes, health, xp, bonusFatePoints) exist */
export function loadCharacter(storageKey: string = STORAGE_KEY_BASIC, theme?: Theme): Character | null {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
		if (!raw) return null;
		const data = JSON.parse(raw) as Character;
		if (!data?.attributes) return null;
		const empty = theme ? createEmptyCharacter(theme) : null;
		if (empty) {
			const merged = {
				...empty,
				...data,
				notes: data.notes ?? empty.notes,
				health: data.health ?? empty.health,
				xp: data.xp ?? empty.xp,
				bonusFatePoints: data.bonusFatePoints ?? empty.bonusFatePoints ?? 0,
				fate: data.fate ?? empty.fate,
				points: data.points ?? empty.points,
				enhancements: data.enhancements ?? empty.enhancements ?? undefined
			};
			if (theme && merged.fate) {
				merged.fate.current = Math.min(merged.fate.current, merged.fate.max);
			}
			// Ensure custom abilities have ids (custom1, custom2, ...)
			const customAb = merged.custom?.abilities ?? [];
			if (customAb.length > 0) {
				const byId: Record<string, number> = { ...merged.abilities };
				merged.custom = { ...merged.custom, abilities: customAb.map((c: { id?: string; label: string; text?: string; description: string; cost: number }, i: number) => {
					const id = `custom${i + 1}`;
					byId[id] = merged.abilities[c.id ?? id] ?? merged.abilities[id] ?? 0;
					return { id, label: c.label, text: c.text, description: c.description, cost: c.cost ?? 1 };
				}) };
				merged.abilities = byId;
			}
			// Ensure custom enhancements have ids (enh1, enh2, ...)
			const customEnh = merged.custom?.enhancements ?? [];
			if (customEnh.length > 0) {
				const byId: Record<string, number> = { ...(merged.enhancements ?? {}) };
				merged.custom = { ...merged.custom, enhancements: customEnh.map((c: { id?: string; label: string; text?: string; description: string; cost: number }, i: number) => {
					const id = `enh${i + 1}`;
					byId[id] = (merged.enhancements ?? {})[c.id ?? id] ?? (merged.enhancements ?? {})[id] ?? 0;
					return { id, label: c.label, text: c.text, description: c.description, cost: c.cost ?? 1 };
				}) };
				merged.enhancements = byId;
			}
			return merged;
		}
		return data;
	} catch {
		return null;
	}
}

/** Save character to localStorage (syncs health max and fate max from theme when provided) */
export function saveCharacter(character: Character, storageKey: string = STORAGE_KEY_BASIC, theme?: Theme): void {
	try {
		if (typeof localStorage !== 'undefined') {
			const toSave = theme ? syncHealthMaxToCharacter(character, theme) : character;
			localStorage.setItem(storageKey, JSON.stringify(toSave));
		}
	} catch (_) {}
}

export { STORAGE_KEY_BASIC, STORAGE_KEY_NEON };
