/** FarkPG ZnZ – static definitions (aligns with Foundry farkpg-znz core skill keys). */

export type ZnzAttrKey = 'body' | 'adroit' | 'mind';

export const ZNZ_ATTR_ORDER: ZnzAttrKey[] = ['body', 'adroit', 'mind'];

export const ZNZ_ATTR_LABELS: Record<ZnzAttrKey, string> = {
	body: 'Body',
	adroit: 'Adroit',
	mind: 'Mind'
};

export const ZNZ_ATTR_BLURBS: Record<ZnzAttrKey, string> = {
	body: 'Physical capabilities. Determines max health.',
	adroit: 'Expertise and dexterity. Determines movement speed.',
	mind: 'Mental and social capabilities. Determines max AP.'
};

/** Core skills: Foundry camelCase keys + display + description */
export const ZNZ_CORE_SKILLS: Record<
	ZnzAttrKey,
	{ id: string; label: string; description: string }[]
> = {
	body: [
		{ id: 'meleeWeapons', label: 'Melee Weapons', description: 'Skill with melee weaponry.' },
		{ id: 'block', label: 'Block', description: 'Block damage dealt in an area.' },
		{
			id: 'unarmed',
			label: 'Unarmed',
			description: 'Unarmed combat. Unarmed deals 0.5× damage by default (1× with Martial Artist).'
		},
		{ id: 'endurance', label: 'Endurance', description: 'Resist physical damage and health conditions.' },
		{ id: 'athletics', label: 'Athletics', description: 'Swimming, climbing, and similar exertion.' }
	],
	adroit: [
		{ id: 'rangedWeapons', label: 'Ranged Weapons', description: 'Skill with ranged weaponry.' },
		{ id: 'dodge', label: 'Dodge', description: 'Avoid damage for yourself only.' },
		{ id: 'throwing', label: 'Throwing', description: 'Thrown weapons and objects.' },
		{ id: 'coordination', label: 'Coordination', description: 'Hand-eye coordination and balance.' },
		{ id: 'stealth', label: 'Stealth', description: 'Avoid detection.' }
	],
	mind: [
		{ id: 'charisma', label: 'Charisma', description: 'Social skills.' },
		{ id: 'intelligence', label: 'Intelligence', description: 'Smarts and capacity for learning.' },
		{ id: 'perception', label: 'Perception', description: 'Senses and noticing important details.' },
		{ id: 'sanity', label: 'Sanity', description: 'Enduring psychological stress and damage.' },
		{ id: 'instinct', label: 'Instinct', description: 'Sense impending danger.' }
	]
};

export const ZNZ_CORE_SKILL_IDS: string[] = ZNZ_ATTR_ORDER.flatMap((a) => ZNZ_CORE_SKILLS[a].map((s) => s.id));

/** Preset add-on skills (not in Foundry core list; exported separately). */
export const ZNZ_ADDON_PRESETS: {
	id: string;
	attribute: ZnzAttrKey;
	label: string;
	description: string;
	kind: 'normal' | 'knowledge';
}[] = [
	{ id: 'parkour', attribute: 'body', label: 'Parkour', description: 'Move through terrain efficiently.', kind: 'normal' },
	{ id: 'grapple', attribute: 'body', label: 'Grapple', description: 'Wrestle and restrain.', kind: 'normal' },
	{ id: 'cardio', attribute: 'body', label: 'Cardio', description: 'Reduce costs to move over long distances.', kind: 'normal' },
	{
		id: 'thievery',
		attribute: 'adroit',
		label: 'Thievery',
		description: 'Lockpicking, breaking and entering, hotwiring.',
		kind: 'normal'
	},
	{ id: 'crafting', attribute: 'adroit', label: 'Crafting', description: 'Craft and create items.', kind: 'normal' },
	{
		id: 'sleightOfHand',
		attribute: 'adroit',
		label: 'Sleight of Hand',
		description: 'Perform tricks and sly movements.',
		kind: 'normal'
	},
	{
		id: 'improvisedWeaponry',
		attribute: 'mind',
		label: 'Improvised Weaponry',
		description: 'Improvise weapons from the environment or use the environment for attacks.',
		kind: 'normal'
	},
	{
		id: 'aura',
		attribute: 'mind',
		label: 'Aura',
		description: 'Ability to intimidate or attract attention.',
		kind: 'normal'
	}
];

export const ZNZ_KNOWLEDGE_PRESETS: { id: string; label: string }[] = [
	{ id: 'engineering', label: 'Engineering' },
	{ id: 'construction', label: 'Construction' },
	{ id: 'medical', label: 'Medical' },
	{ id: 'science', label: 'Science (specify subject)' },
	{ id: 'computer', label: 'Computer' },
	{ id: 'farming', label: 'Farming' },
	{ id: 'firefighting', label: 'Firefighting' },
	{ id: 'foraging', label: 'Foraging' },
	{ id: 'hunting', label: 'Hunting' },
	{ id: 'vehicleHandling', label: 'Vehicle Handling' },
	{ id: 'trapMaking', label: 'Trap making' },
	{ id: 'investigation', label: 'Investigation' }
];

export interface ZnzAbilityDef {
	id: string;
	label: string;
	costText: string;
	description: string;
}

export const ZNZ_STARTING_ABILITIES: ZnzAbilityDef[] = [
	{ id: 'snipe', label: 'Snipe', costText: 'Cost 4 AP', description: 'Your next ranged attack deals 2× damage.' },
	{
		id: 'shieldBash',
		label: 'Shield Bash',
		costText: 'Cost 3 AP',
		description: 'Your next block roll deals half the block value as damage.'
	},
	{ id: 'rampage', label: 'Rampage', costText: 'Cost 4 AP', description: 'Your next melee attack deals 3× damage.' },
	{
		id: 'maximumEffort',
		label: 'Maximum Effort',
		costText: 'Cost 4 AP',
		description:
			'Declare a number 1–6. Your next Farkroll scores +50 points on that number. Applies to individual rolls only.'
	},
	{
		id: 'lockedAndLoaded',
		label: 'Locked and Loaded',
		costText: 'Passive',
		description: 'Start with a handgun and 20 ammo.'
	},
	{ id: 'bushwhack', label: 'Bushwhack', costText: 'Passive', description: 'Start with a melee weapon of your choice.' },
	{
		id: 'gearedUp',
		label: 'Geared Up',
		costText: 'Passive',
		description: 'Start with a backpack and basic travel kit.'
	},
	{
		id: 'martialArtist',
		label: 'Martial Artist',
		costText: 'Passive',
		description: 'Your unarmed attacks deal 1× damage instead of 0.5×.'
	},
	{ id: 'stocked', label: 'Stocked', costText: 'Passive', description: 'Start with additional food and water.' },
	{ id: 'activeReload', label: 'Hot Hands', costText: 'Passive', description: 'Reloading a weapon no longer takes an action.' }
];

/** Skill points per attribute during creation: 2 × number of core skills in that attribute. */
export function znzSkillPoolSize(attr: ZnzAttrKey): number {
	return 2 * ZNZ_CORE_SKILLS[attr].length;
}

export function znzAddonById(id: string) {
	return ZNZ_ADDON_PRESETS.find((a) => a.id === id);
}

export function znzKnowledgeLabel(presetId: string, detail: string): string {
	const p = ZNZ_KNOWLEDGE_PRESETS.find((k) => k.id === presetId);
	const base = p?.label ?? presetId;
	if (presetId === 'science' && detail.trim()) return `${base}: ${detail.trim()}`;
	return base;
}
