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

/** When set, health max is derived from an attribute. */
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
	enhancements?: AbilityDef[];
	points: ThemePoints;
	fateMax?: number;
	luckMax?: number;
	healthMax?: number;
	healthFromAttribute?: HealthFromAttribute;
	/** Display label for the resource pool (Fate, Luck, AP, etc.) */
	resourceLabel?: string;
}

export interface InventoryEntry {
	itemId: string;
	quantity: number;
	equipped: boolean;
	slot: string | null;
	label?: string;
}

/** Character state stored in characters.data jsonb */
export interface CharacterData {
	schemaVersion: number;
	attributes: Record<string, number>;
	skills: Record<string, Record<string, number>>;
	abilities: Record<string, number>;
	enhancements?: Record<string, number>;
	points: ThemePoints;
	health?: { current: number; max: number };
	xp?: number;
	bonusFatePoints?: number;
	fate: { current: number; max: number };
	notes?: string;
	inventory?: InventoryEntry[];
	custom?: {
		skills?: Record<string, Array<{ label: string; value: number; attribute?: string }>>;
		abilities?: Array<{ id: string; label: string; text?: string; description: string; cost: number }>;
		enhancements?: Array<{ id: string; label: string; text?: string; description: string; cost: number }>;
	};
	/** ZnZ-specific fields when theme_id is znz */
	znz?: {
		biography?: string;
		addonSkills?: Array<{ key: string; label: string; rank: number; attribute: string }>;
		customSkills?: Array<{ id: string; label: string; rank: number; attribute: string }>;
		movement?: number;
		actionPoints?: { current: number; max: number };
		startingAbilityId?: string;
	};
}

export interface ItemData {
	schemaVersion: number;
	type: string;
	description?: string;
	stats?: Record<string, string | number>;
	equipSlot?: string | null;
	tags?: string[];
}

export interface DbCharacter {
	id: string;
	campaign_id: string | null;
	owner_id: string;
	theme_id: string;
	name: string;
	data: CharacterData;
	created_at: string;
	updated_at: string;
}

export interface DbItem {
	id: string;
	campaign_id: string;
	name: string;
	data: ItemData;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface DbCampaign {
	id: string;
	name: string;
	invite_code: string;
	created_by: string;
	created_at: string;
}

export interface DbCampaignMember {
	campaign_id: string;
	user_id: string;
	role: 'gm' | 'player';
	joined_at: string;
	profiles?: { display_name: string | null };
}
