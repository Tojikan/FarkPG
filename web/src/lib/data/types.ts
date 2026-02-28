/** Attribute definition in a theme */
export interface AttributeDef {
	id: string;
	label: string;
	abbr: string;
	min: number;
	max: number;
	default: number;
}

/** Skill definition within a category */
export interface SkillDef {
	id: string;
	label: string;
	attribute?: string;
	description?: string;
}

/** Skill category */
export interface SkillCategory {
	id: string;
	label: string;
	alwaysDisplay?: boolean;
	max?: number;
	skills: SkillDef[];
}

/** Ability definition */
export interface AbilityDef {
	id: string;
	label: string;
	cost: number;
	levelable?: boolean;
	maxLevel?: number;
	description: string;
}

/** Point pools for a theme */
export interface ThemePoints {
	attributes: number;
	skills: Record<string, number>;
	abilities: number;
}

/**
 * When set, health max is derived from an attribute.
 * Formula: baseValue + (attributeValue - atStat) * perPoint
 * Example: baseValue 10000, atStat 3, perPoint 2000 → 10000 at endurance 3, ±2000 per point
 */
export interface HealthFromAttribute {
	attributeId: string;
	baseValue: number;
	atStat: number;
	perPoint: number;
}

/** Full theme (builder config) */
export interface Theme {
	id: string;
	label: string;
	attributes: AttributeDef[];
	skills: Record<string, SkillCategory>;
	abilities: AbilityDef[];
	/** Optional second ability-like list (e.g. enhancements); shares ability point pool */
	enhancements?: AbilityDef[];
	points: ThemePoints;
	fateMax?: number;
	/** Used by some themes (e.g. cyberpunk) instead of fateMax; character still stores as fate. */
	luckMax?: number;
	healthMax?: number;
	/** When set, health max is computed from the given attribute (e.g. Endurance). */
	healthFromAttribute?: HealthFromAttribute;
}

/** Character state (saved/loaded) */
export interface Character {
	name?: string;
	notes?: string;
	attributes: Record<string, number>;
	skills: Record<string, Record<string, number>>;
	abilities: Record<string, number>;
	/** When theme has enhancements; same point pool as abilities */
	enhancements?: Record<string, number>;
	points: ThemePoints;
	health?: { current: number; max: number };
	xp?: number;
	/** Extra fate points added to theme base (fate max = theme.fateMax + bonusFatePoints) */
	bonusFatePoints?: number;
	fate: { current: number; max: number };
	custom?: {
		skills?: Record<string, Array<{ label: string; value: number; attribute?: string }>>;
		/** Custom ability definitions; id is custom1, custom2, ... */
		abilities?: Array<{ id: string; label: string; text?: string; description: string; cost: number }>;
		/** Custom enhancement definitions; id is enh1, enh2, ... */
		enhancements?: Array<{ id: string; label: string; text?: string; description: string; cost: number }>;
	};
	schemaVersion?: number;
}
