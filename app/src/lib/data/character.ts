import type { CharacterData, Theme } from './types.js';
import { getZnzActionPointsMax, getZnzMovement } from './themes/znz.js';

const SCHEMA_VERSION = 1;

export function getResourceMax(theme: Theme, character: CharacterData): number {
	const base = theme.luckMax ?? theme.fateMax ?? 5;
	return base + (character.bonusFatePoints ?? 0);
}

export function getResourceLabel(theme: Theme): string {
	return theme.resourceLabel ?? (theme.luckMax != null ? 'Luck' : 'Fate');
}

export function getHealthMax(character: CharacterData, theme: Theme): number {
	const rule = theme.healthFromAttribute;
	if (rule) {
		const val = character.attributes[rule.attributeId] ?? 0;
		return rule.baseValue + (val - rule.atStat) * rule.perPoint;
	}
	return character.health?.max ?? theme.healthMax ?? 10000;
}

export function syncDerivedStats(character: CharacterData, theme: Theme): CharacterData {
	const healthMax = getHealthMax(character, theme);
	const h = character.health ?? { current: healthMax, max: healthMax };
	const resourceMax = theme.id === 'znz'
		? getZnzActionPointsMax(character.attributes)
		: getResourceMax(theme, character);
	const fate = character.fate ?? { current: resourceMax, max: resourceMax };

	const next: CharacterData = {
		...character,
		schemaVersion: character.schemaVersion ?? SCHEMA_VERSION,
		health: { current: Math.min(h.current, healthMax), max: healthMax },
		fate: { current: Math.min(fate.current, resourceMax), max: resourceMax },
		inventory: character.inventory ?? []
	};

	if (theme.id === 'znz') {
		const apMax = getZnzActionPointsMax(character.attributes);
		next.znz = {
			...character.znz,
			movement: getZnzMovement(character.attributes),
			actionPoints: {
				current: character.znz?.actionPoints?.current ?? apMax,
				max: apMax
			}
		};
	}

	return next;
}

export function createEmptyCharacterData(theme: Theme): CharacterData {
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
	for (const e of theme.enhancements ?? []) {
		enhancements[e.id] = 0;
	}

	const resourceMax = theme.luckMax ?? theme.fateMax ?? 5;

	const base: CharacterData = {
		schemaVersion: SCHEMA_VERSION,
		attributes,
		skills,
		abilities,
		...(Object.keys(enhancements).length > 0 ? { enhancements } : {}),
		points: structuredClone(theme.points),
		health: { current: 0, max: 0 },
		xp: 0,
		bonusFatePoints: 0,
		fate: { current: resourceMax, max: resourceMax },
		notes: '',
		inventory: [],
		custom: {}
	};

	if (theme.id === 'znz') {
		base.znz = {
			biography: '',
			addonSkills: [],
			customSkills: [],
			movement: getZnzMovement(attributes),
			actionPoints: {
				current: getZnzActionPointsMax(attributes),
				max: getZnzActionPointsMax(attributes)
			}
		};
	}

	return syncDerivedStats(base, theme);
}

export function mergeCharacterData(existing: CharacterData, theme: Theme): CharacterData {
	const empty = createEmptyCharacterData(theme);
	return syncDerivedStats(
		{
			...empty,
			...existing,
			attributes: { ...empty.attributes, ...existing.attributes },
			skills: { ...empty.skills, ...existing.skills },
			abilities: { ...empty.abilities, ...existing.abilities },
			points: existing.points ?? empty.points,
			inventory: existing.inventory ?? [],
			custom: existing.custom ?? {}
		},
		theme
	);
}

export function generateInviteCode(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}
