import type { CharacterData, Theme } from './types.js';
import { getActionPointsMax, getMovement, getSkillPoolSize, SKILL_RANK_CAP } from './themes/core.js';

const SCHEMA_VERSION = 1;

/** Plain-object copy safe for Svelte $state proxies (structuredClone can throw). */
export function cloneSheetData(data: CharacterData): CharacterData {
	return JSON.parse(JSON.stringify(data)) as CharacterData;
}

function copyThemePoints(theme: Theme): CharacterData['points'] {
	return {
		attributes: theme.points.attributes,
		skills: { ...theme.points.skills },
		abilities: theme.points.abilities
	};
}

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
	const derivedHealthMax = getHealthMax(character, theme);
	const inBuilder = character.builderComplete === false;
	const healthMax = inBuilder
		? derivedHealthMax
		: Math.max(1, character.health?.max ?? derivedHealthMax);
	const h = character.health ?? { current: healthMax, max: healthMax };
	const resourceMax = getActionPointsMax(character.attributes);
	const fate = character.fate ?? { current: resourceMax, max: resourceMax };

	const next: CharacterData = {
		...character,
		schemaVersion: character.schemaVersion ?? SCHEMA_VERSION,
		health: { current: Math.min(h.current, healthMax), max: healthMax },
		fate: { current: Math.min(fate.current, resourceMax), max: resourceMax },
		inventory: character.inventory ?? [],
		...(inBuilder ? { points: copyThemePoints(theme) } : {})
	};

	const derivedApMax = getActionPointsMax(character.attributes);
	const apMax = inBuilder
		? derivedApMax
		: Math.max(1, character.znz?.actionPoints?.max ?? derivedApMax);
	next.znz = {
		...character.znz,
		movement: inBuilder ? getMovement(character.attributes) : (character.znz?.movement ?? getMovement(character.attributes)),
		actionPoints: {
			current: Math.min(character.znz?.actionPoints?.current ?? apMax, apMax),
			max: apMax
		}
	};

	return next;
}

export function getAttributeSum(character: CharacterData, theme: Theme): number {
	let sum = 0;
	for (const a of theme.attributes) {
		sum += character.attributes[a.id] ?? a.default;
	}
	return sum;
}

/** Total attribute rating spent (sum of Body + Adroit + Mind). */
export function getSpentAttributePoints(character: CharacterData, theme: Theme): number {
	return getAttributeSum(character, theme);
}

/** Highest legal value for one attribute given pool and per-stat max. */
export function getAttributeMax(character: CharacterData, theme: Theme, attributeId: string): number {
	const attr = theme.attributes.find((a) => a.id === attributeId);
	if (!attr) return 0;
	const current = character.attributes[attributeId] ?? attr.default;
	const otherSum = getAttributeSum(character, theme) - current;
	const byPool = theme.points.attributes - otherSum;
	return Math.max(current, Math.min(attr.max, byPool));
}

/** Total point cost to raise a skill from 0 to `level` (1+2+…+level). */
export function getTriangularCostToLevel(level: number): number {
	const L = Math.max(0, Math.floor(level));
	return (L * (L + 1)) / 2;
}

/** Points required to raise a skill from its current level by one rank. */
export function getCostToRaiseSkill(currentLevel: number): number {
	return Math.max(1, Math.floor(currentLevel) + 1);
}

export function getSkillPoolForCategory(_character: CharacterData, theme: Theme, categoryId: string): number {
	return getSkillPoolSize(theme, categoryId) || theme.points.skills[categoryId] || 0;
}

export function getSkillPointsSpentForCategory(
	character: CharacterData,
	theme: Theme,
	categoryId: string
): number {
	let spent = 0;
	const cat = theme.skills[categoryId];
	if (cat) {
		for (const skill of cat.skills) {
			if (skill.kind === 'knowledge') continue;
			spent += getTriangularCostToLevel(character.skills[categoryId]?.[skill.id] ?? 0);
		}
	}
	if (categoryId === 'mind') {
		for (const line of character.znz?.knowledgeLines ?? []) {
			spent += getTriangularCostToLevel(line.rank);
		}
	}
	for (const custom of character.znz?.customSkills ?? []) {
		if (custom.attribute === categoryId) {
			spent += getTriangularCostToLevel(custom.rank);
		}
	}
	return spent;
}


export function getSpentAbilityPoints(character: CharacterData, theme: Theme): number {
	let spent = 0;
	for (const ab of theme.abilities) {
		const level = character.abilities[ab.id] ?? 0;
		if (level > 0) spent += ab.cost * (ab.levelable ? level : 1);
	}
	for (const e of theme.enhancements ?? []) {
		const level = (character.enhancements ?? {})[e.id] ?? 0;
		if (level > 0) spent += e.cost * (e.levelable ? level : 1);
	}
	return spent;
}

export function getRemainingAttributePoints(character: CharacterData, theme: Theme): number {
	const pool = theme.points.attributes;
	return pool - getSpentAttributePoints(character, theme);
}

export function getRemainingSkillPoints(
	character: CharacterData,
	theme: Theme,
	categoryId: string
): number {
	const pool = getSkillPoolForCategory(character, theme, categoryId);
	return pool - getSkillPointsSpentForCategory(character, theme, categoryId);
}

/** Count skills (and knowledge/custom lines) with rank > 0 across all categories. */
export function getTotalSkillsSelected(character: CharacterData, theme: Theme): number {
	let count = 0;
	for (const catId of Object.keys(theme.skills)) {
		const cat = theme.skills[catId];
		for (const skill of cat.skills) {
			if (skill.kind === 'knowledge') continue;
			if ((character.skills[catId]?.[skill.id] ?? 0) > 0) count++;
		}
	}
	count += (character.znz?.knowledgeLines ?? []).filter((l) => l.rank > 0).length;
	count += (character.znz?.customSkills ?? []).filter((c) => c.rank > 0).length;
	return count;
}

export function getTotalSkillDefinitions(theme: Theme): number {
	let count = 0;
	for (const cat of Object.values(theme.skills)) {
		count += cat.skills.filter((s) => s.kind !== 'knowledge').length;
	}
	count += 1; // knowledge entry counts as one selectable type
	return count;
}

export function getRemainingAbilityPoints(character: CharacterData, theme: Theme): number {
	const pool = theme.points.abilities;
	return pool - getSpentAbilityPoints(character, theme);
}

export function getTotalSkillPointsSpent(character: CharacterData, theme: Theme): number {
	return Object.keys(theme.skills).reduce(
		(sum, catId) => sum + getSkillPointsSpentForCategory(character, theme, catId),
		0
	);
}

export function getTotalSkillPointsPool(_character: CharacterData, theme: Theme): number {
	return Object.keys(theme.skills).reduce(
		(sum, catId) => sum + getSkillPoolForCategory(_character, theme, catId),
		0
	);
}

export function canAffordSkillRankIncrease(
	character: CharacterData,
	theme: Theme,
	categoryId: string,
	currentLevel: number
): boolean {
	const cost = getCostToRaiseSkill(currentLevel);
	return getRemainingSkillPoints(character, theme, categoryId) >= cost;
}

export function newLineId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function migrateThrowingSkill(skills: CharacterData['skills'] | undefined): CharacterData['skills'] | undefined {
	if (!skills) return skills;
	const legacy = skills.body?.throwing;
	if (typeof legacy !== 'number' || legacy <= 0) return skills;
	const next = {
		...skills,
		body: { ...skills.body },
		adroit: { ...skills.adroit, throwing: Math.max(skills.adroit?.throwing ?? 0, legacy) }
	};
	delete next.body.throwing;
	return next;
}

function mergeBuilderSkills(
	existing: CharacterData,
	empty: CharacterData,
	theme: Theme
): CharacterData['skills'] {
	const skills = cloneSheetData(empty).skills;
	const sourceSkills = migrateThrowingSkill(existing.skills) ?? existing.skills;
	for (const catId of Object.keys(theme.skills)) {
		for (const skill of theme.skills[catId].skills) {
			if (skill.kind === 'knowledge') continue;
			const val = sourceSkills?.[catId]?.[skill.id];
			if (typeof val === 'number' && val >= 0) {
				skills[catId][skill.id] = Math.min(Math.floor(val), SKILL_RANK_CAP);
			}
		}
	}
	return skills;
}

/** Reset a category if legacy linear ranks exceed the triangular pool budget. */
export function normalizeBuilderSkillSpend(data: CharacterData, theme: Theme): CharacterData {
	const next = cloneSheetData(data);
	for (const catId of Object.keys(theme.skills)) {
		if (
			getSkillPointsSpentForCategory(next, theme, catId) <=
			getSkillPoolForCategory(next, theme, catId)
		) {
			continue;
		}
		for (const skill of theme.skills[catId].skills) {
			if (skill.kind === 'knowledge') continue;
			next.skills[catId][skill.id] = 0;
		}
		if (catId === 'mind') {
			next.znz = { ...next.znz, knowledgeLines: [] };
		}
		next.znz = {
			...next.znz,
			customSkills: (next.znz?.customSkills ?? []).filter((c) => c.attribute !== catId)
		};
	}
	return next;
}

export function isBuilderComplete(character: CharacterData): boolean {
	return character.builderComplete !== false;
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

	const resourceMax = getActionPointsMax(attributes);

	const base: CharacterData = {
		schemaVersion: SCHEMA_VERSION,
		builderComplete: false,
		attributes,
		skills,
		abilities,
		...(Object.keys(enhancements).length > 0 ? { enhancements } : {}),
		points: copyThemePoints(theme),
		health: { current: 0, max: 0 },
		xp: 0,
		bonusFatePoints: 0,
		fate: { current: resourceMax, max: resourceMax },
		notes: '',
		inventory: [],
		custom: {}
	};

	base.znz = {
		biography: '',
		addonSkills: [],
		customSkills: [],
		knowledgeLines: [],
		movement: getMovement(attributes),
		actionPoints: {
			current: getActionPointsMax(attributes),
			max: getActionPointsMax(attributes)
		}
	};

	return syncDerivedStats(base, theme);
}

export function mergeCharacterData(existing: CharacterData, theme: Theme): CharacterData {
	const empty = createEmptyCharacterData(theme);
	const inBuilder = existing.builderComplete === false;
	const sourceSkills = migrateThrowingSkill(existing.skills) ?? existing.skills;
	const mergedSkills = inBuilder
		? mergeBuilderSkills(existing, empty, theme)
		: Object.fromEntries(
				Object.keys(empty.skills).map((catId) => [
					catId,
					{ ...empty.skills[catId], ...sourceSkills?.[catId] }
				])
			);
	const merged = syncDerivedStats(
		{
			...empty,
			...existing,
			attributes: { ...empty.attributes, ...existing.attributes },
			skills: mergedSkills,
			abilities: { ...empty.abilities, ...existing.abilities },
			builderComplete: existing.builderComplete ?? true,
			points: inBuilder ? copyThemePoints(theme) : (existing.points ?? empty.points),
			inventory: existing.inventory ?? [],
			custom: existing.custom ?? {},
			znz: {
				...empty.znz,
				...existing.znz,
				customSkills: existing.znz?.customSkills ?? empty.znz?.customSkills ?? [],
				knowledgeLines: existing.znz?.knowledgeLines ?? empty.znz?.knowledgeLines ?? []
			}
		},
		theme
	);
	return inBuilder ? normalizeBuilderSkillSpend(merged, theme) : merged;
}

export function generateInviteCode(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}
