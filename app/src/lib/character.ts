import type { SettingDefinition } from './settings/types';
import { evaluateFormula } from './settings/formulas';

export interface CharacterSkill {
	id: string;
	name: string;
	attribute: string;
	rank: number;
	description?: string;
	custom: boolean;
}

export interface CharacterAbility {
	id: string;
	name: string;
	rank: number;
	description?: string;
	custom?: boolean;
}

export interface InventoryItem {
	uid: string;
	name: string;
	description?: string;
	qty: number;
	equipped: boolean;
	data: Record<string, string | number>;
}

export interface CharacterData {
	background?: string;
	attributes: Record<string, number>;
	skills: CharacterSkill[];
	resources: Record<string, { current: number; max: number }>;
	abilities: CharacterAbility[];
	inventory: InventoryItem[];
	notes: string;
}

export function uid(): string {
	return crypto.randomUUID();
}

export function createEmptyData(setting: SettingDefinition): CharacterData {
	const attributes = Object.fromEntries(
		setting.attributes.map((a) => [a.id, setting.creation.attributes.start])
	);
	const data: CharacterData = {
		attributes,
		skills: [],
		resources: {},
		abilities: [],
		inventory: [],
		notes: ''
	};
	return syncDerived(setting, data);
}

/**
 * Recompute formula-derived resource maxima from current attributes.
 * `current` follows `max` by the same delta (a Body raise heals the
 * new points; a drop removes them), clamped to [0, max].
 */
export function syncDerived(setting: SettingDefinition, data: CharacterData): CharacterData {
	const resources = { ...data.resources };
	for (const def of setting.resources) {
		const max = evaluateFormula(def.formula, data.attributes);
		const prev = resources[def.id];
		const current =
			prev == null ? max : Math.max(0, Math.min(max, prev.current + (max - prev.max)));
		resources[def.id] = { current, max };
	}
	return { ...data, resources };
}

/** Fill any missing shape on data loaded from the DB (defensive against old saves). */
export function normalizeData(setting: SettingDefinition, raw: unknown): CharacterData {
	const d = (raw ?? {}) as Partial<CharacterData>;
	const data: CharacterData = {
		background: d.background,
		attributes: { ...Object.fromEntries(setting.attributes.map((a) => [a.id, setting.creation.attributes.start])), ...(d.attributes ?? {}) },
		skills: d.skills ?? [],
		resources: d.resources ?? {},
		abilities: d.abilities ?? [],
		inventory: d.inventory ?? [],
		notes: d.notes ?? ''
	};
	return syncDerived(setting, data);
}
