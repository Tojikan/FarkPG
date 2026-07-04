// Types for the JSON setting schema. Each setting (last-empire.json,
// zombie.json, ...) is plain data conforming to SettingDefinition.

export interface AttributeDef {
	id: string;
	name: string;
	description?: string;
}

/** value = base + (attributes[attribute] - baseline) * perPoint */
export interface ResourceFormula {
	base: number;
	attribute?: string;
	baseline?: number;
	perPoint?: number;
}

export interface ResourceDef {
	id: string;
	name: string;
	formula: ResourceFormula;
}

export interface SkillDef {
	id: string;
	name: string;
	/** id of the attribute this skill is grouped under */
	attribute: string;
	description?: string;
}

export interface AbilityDef {
	id: string;
	name: string;
	description?: string;
}

export interface BackgroundDef {
	id: string;
	name: string;
	description?: string;
	bonus: {
		pool: 'attributes' | 'skills' | 'abilities';
		amount: number;
	};
}

export interface ItemFieldDef {
	id: string;
	name: string;
	type: 'text' | 'number';
}

export interface ItemTemplate {
	name: string;
	description?: string;
	data?: Record<string, string | number>;
}

export interface AttributeCreationRules {
	/**
	 * escalating: each step above `start` costs its distance from `start`
	 *   (start+1 costs 1, start+2 costs 2, ...). Each step below `start`
	 *   refunds 1 point.
	 * flat: every step above `start` costs 1; steps below refund 1 each.
	 */
	mode: 'escalating' | 'flat';
	pool: number;
	start: number;
	min: number;
	max: number;
}

export interface SkillCreationRules {
	pool: number;
	maxRank: number;
	/** cost of each successive rank; total cost of rank n = sum of first n entries */
	rankCosts: number[];
}

export interface AbilityCreationRules {
	mode: 'point-buy' | 'pick';
	/** point-buy */
	pool?: number;
	maxRank?: number;
	rankCosts?: number[];
	/** pick */
	count?: number;
}

export interface SettingFlags {
	allowCustomSkills: boolean;
	allowCustomAbilities: boolean;
	playersCanAddAbilities: boolean;
}

export interface SettingDefinition {
	id: string;
	name: string;
	tagline?: string;
	/** label used for the abilities section, e.g. "Magic" or "Perks" */
	abilitiesLabel?: string;
	attributes: AttributeDef[];
	resources: ResourceDef[];
	skills: SkillDef[];
	abilities: AbilityDef[];
	backgrounds?: BackgroundDef[];
	itemFields: ItemFieldDef[];
	itemTemplates: ItemTemplate[];
	creation: {
		attributes: AttributeCreationRules;
		skills: SkillCreationRules;
		abilities: AbilityCreationRules;
	};
	flags: SettingFlags;
}
