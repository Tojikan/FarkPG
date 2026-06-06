/** Attribute definition in a theme */
export interface AttributeDef {
	id: string;
	label: string;
	abbr: string;
	min: number;
	max: number;
	default: number;
	/** Shown on the attribute step of the builder */
	description?: string;
}

/** Skill definition within a category */
export interface SkillDef {
	id: string;
	label: string;
	attribute?: string;
	description?: string;
	/** Knowledge uses specialization lines instead of a single rank field */
	kind?: 'normal' | 'knowledge';
}

export interface KnowledgePreset {
	id: string;
	label: string;
}

export interface KnowledgeLine {
	id: string;
	presetId: string;
	detail: string;
	rank: number;
}

export interface CustomSkillLine {
	id: string;
	label: string;
	description: string;
	attribute: string;
	rank: number;
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
	/** Additional detail paragraphs shown in the builder and sheet */
	details?: string[];
	/** Font Awesome icon class for builder / sheet display */
	icon?: string;
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

export type ItemKind = 'consumable' | 'equipment' | 'melee_weapon' | 'ranged_weapon';

export interface ItemFeatures {
	hasQuantity?: boolean;
	hasDurability?: boolean;
	hasAmmo?: boolean;
	hasDamage?: boolean;
}

export interface ItemResourcePair {
	current: number;
	max: number;
}

export interface ItemDamage {
	base: number;
	additional: number;
}

export interface InventoryEntry {
	itemId: string;
	equipped: boolean;
	label?: string;
	description?: string;
	itemKind?: ItemKind;
	features?: ItemFeatures;
	quantity?: number;
	durability?: ItemResourcePair;
	ammo?: ItemResourcePair;
	damage?: ItemDamage;
	imagePath?: string;
	imageUpdatedAt?: string;
	/** @deprecated Legacy slot label */
	slot?: string | null;
	/** @deprecated Legacy type string */
	itemType?: string;
	/** @deprecated Legacy free-form stats */
	stats?: Record<string, string | number>;
}

/** Character state stored in characters.data jsonb */
export interface CharacterData {
	schemaVersion: number;
	/** When false, user is guided through the build wizard before the play sheet */
	builderComplete?: boolean;
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
	xpMax?: number;
	custom?: {
		skills?: Record<string, Array<{ label: string; value: number; attribute?: string }>>;
		abilities?: Array<{
			id: string;
			label: string;
			text?: string;
			description: string;
			cost?: number;
			imagePath?: string;
			imageUpdatedAt?: string;
			/** @deprecated Legacy active/passive flag */
			kind?: 'passive' | 'active';
			/** @deprecated Legacy active slot flag */
			active?: boolean;
		}>;
		enhancements?: Array<{ id: string; label: string; text?: string; description: string; cost: number }>;
	};
	znz?: {
		biography?: string;
		addonSkills?: Array<{ key: string; label: string; rank: number; attribute: string }>;
		customSkills?: CustomSkillLine[];
		knowledgeLines?: KnowledgeLine[];
		movement?: number;
		actionPoints?: { current: number; max: number };
		startingAbilityId?: string;
		equipmentSlotsMax?: number;
		inventorySlotsMax?: number;
		portraitPath?: string;
		portraitUpdatedAt?: string;
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
