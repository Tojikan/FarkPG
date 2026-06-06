import type { KnowledgePreset, Theme } from '../types.js';

export function getMovement(attributes: Record<string, number>): number {
	const adroit = attributes.adroit ?? 3;
	return 20 + (adroit - 3) * 5;
}

export function getActionPointsMax(attributes: Record<string, number>): number {
	const mind = attributes.mind ?? 3;
	return 18 + (mind - 3) * 2;
}

export const KNOWLEDGE_PRESETS: KnowledgePreset[] = [
	{ id: 'biology', label: 'Biology' },
	{ id: 'chemistry', label: 'Chemistry' },
	{ id: 'cryogenics', label: 'Cryogenics' },
	{ id: 'cybernetics', label: 'Cybernetics' },
	{ id: 'construction', label: 'Construction' },
	{ id: 'electrical', label: 'Electrical' },
	{ id: 'engineering', label: 'Engineering' },
	{ id: 'droneOperation', label: 'Drone Operation' },
	{ id: 'psychology', label: 'Psychology' },
	{ id: 'plumbing', label: 'Plumbing' },
	{ id: 'robotics', label: 'Robotics' },
	{ id: 'nature', label: 'Nature' },
	{ id: 'environment', label: 'Environment' },
	{ id: 'xenobiology', label: 'Xenobiology' }
];

export const SKILL_RANK_CAP = 4;

/** Single FarkPG ruleset: Body / Adroit / Mind + granular skills */
export const coreTheme: Theme = {
	id: 'core',
	label: 'FarkPG',
	resourceLabel: 'AP',
	attributes: [
		{
			id: 'body',
			label: 'Body',
			abbr: 'BOD',
			min: 1,
			max: 6,
			default: 1,
			description: 'Physical power, strength, and resilience.'
		},
		{
			id: 'adroit',
			label: 'Adroit',
			abbr: 'ADR',
			min: 1,
			max: 6,
			default: 1,
			description: 'Agility, reflexes, and manual skill.'
		},
		{
			id: 'mind',
			label: 'Mind',
			abbr: 'MND',
			min: 1,
			max: 6,
			default: 1,
			description: 'Knowledge, reasoning, and mental focus.'
		}
	],
	skills: {
		body: {
			id: 'body',
			label: 'Body',
			alwaysDisplay: true,
			skills: [
				{ id: 'strength', label: 'Strength', attribute: 'body', description: 'Physical power and force.' },
				{ id: 'endurance', label: 'Endurance', attribute: 'body', description: 'Resist damage, fatigue, and harsh conditions.' },
				{ id: 'meleeCombat', label: 'Melee Combat', attribute: 'body', description: 'Fight effectively with melee weapons.' },
				{ id: 'block', label: 'Block', attribute: 'body', description: 'Interpose yourself or cover against attacks.' },
				{ id: 'athletics', label: 'Athletics', attribute: 'body', description: 'Climbing, swimming, and strenuous movement.' },
				{ id: 'acrobatics', label: 'Acrobatics', attribute: 'body', description: 'Balance, tumbling, and agile movement.' },
				{ id: 'parkour', label: 'Parkour', attribute: 'body', description: 'Move quickly through complex terrain.' },
				{ id: 'cardio', label: 'Cardio', attribute: 'body', description: 'Sustain effort over long distances.' },
				{ id: 'grappling', label: 'Grappling', attribute: 'body', description: 'Restrain, wrestle, and control opponents.' }
			]
		},
		adroit: {
			id: 'adroit',
			label: 'Adroit',
			alwaysDisplay: true,
			skills: [
				{ id: 'rangedCombat', label: 'Ranged Combat', attribute: 'adroit', description: 'Fight effectively with ranged weapons.' },
				{ id: 'throwing', label: 'Throwing', attribute: 'adroit', description: 'Accurate throws with weapons or objects.' },
				{ id: 'dodging', label: 'Dodging', attribute: 'adroit', description: 'Avoid attacks directed at you.' },
				{ id: 'stealth', label: 'Stealth', attribute: 'adroit', description: 'Move and act without being noticed.' },
				{ id: 'coordination', label: 'Coordination', attribute: 'adroit', description: 'Precise hand-eye control and fine motor skill.' },
				{ id: 'crafting', label: 'Crafting', attribute: 'adroit', description: 'Build, repair, and modify equipment.' },
				{ id: 'trapmaking', label: 'Trapmaking', attribute: 'adroit', description: 'Create and deploy traps.' },
				{ id: 'thievery', label: 'Thievery', attribute: 'adroit', description: 'Bypass locks, security, and safeguards.' },
				{ id: 'piloting', label: 'Piloting', attribute: 'adroit', description: 'Operate vehicles and aircraft.' },
				{ id: 'sleightOfHand', label: 'Sleight of Hand', attribute: 'adroit', description: 'Conceal, palm, and manipulate objects subtly.' },
				{ id: 'survival', label: 'Survival', attribute: 'adroit', description: 'Endure and operate in hostile environments.' },
				{ id: 'zeroGManeuvering', label: 'Zero G Maneuvering', attribute: 'adroit', description: 'Move and fight in zero gravity.' }
			]
		},
		mind: {
			id: 'mind',
			label: 'Mind',
			alwaysDisplay: true,
			skills: [
				{ id: 'charisma', label: 'Charisma', attribute: 'mind', description: 'Persuade, lead, and influence others.' },
				{ id: 'intellect', label: 'Intellect', attribute: 'mind', description: 'Reason, recall, and learn quickly.' },
				{ id: 'insight', label: 'Insight', attribute: 'mind', description: 'Read motives, tone, and hidden intent.' },
				{ id: 'perception', label: 'Perception', attribute: 'mind', description: 'Notice important details with your senses.' },
				{ id: 'sanity', label: 'Sanity', attribute: 'mind', description: 'Withstand fear, stress, and mental strain.' },
				{ id: 'instinct', label: 'Instinct', attribute: 'mind', description: 'Sense danger before it arrives.' },
				{ id: 'investigation', label: 'Investigation', attribute: 'mind', description: 'Gather clues and connect evidence.' },
				{ id: 'navigation', label: 'Navigation', attribute: 'mind', description: 'Orient yourself and plot routes.' },
				{ id: 'hacking', label: 'Hacking', attribute: 'mind', description: 'Bypass and control computer systems.' },
				{ id: 'medical', label: 'Medical', attribute: 'mind', description: 'Treat injuries and medical conditions.' },
				{ id: 'aura', label: 'Aura', attribute: 'mind', description: 'Command attention through presence.' },
				{
					id: 'knowledge',
					label: 'Knowledge',
					attribute: 'mind',
					description: 'Specialized technical and scientific fields.',
					kind: 'knowledge'
				},
				{ id: 'shipOperations', label: 'Ship Operations', attribute: 'mind', description: 'Run spacecraft systems and procedures.' }
			]
		}
	},
	abilities: [
		{
			id: 'cyborgArm',
			label: 'Cyborg Arm',
			cost: 1,
			icon: 'fa-solid fa-hand-fist',
			description:
				'Advanced arm that can be extended for additional features. Current features: Stun gun, Knife attachment, automatic lockpicking. Gain +2 Thievery skill and +2 Block skill. Player can block without equipment or items.',
			details: [
				'Can make a D20 attack with highly varying results. This attack can be a bonus action but costs 4 AP if used this way.'
			]
		},
		{
			id: 'mostlyMachine',
			label: 'Mostly Machine',
			cost: 1,
			icon: 'fa-solid fa-robot',
			description:
				'Held together by multiple prosthetics have resulted in peak less-than-human form.',
			details: [
				'Player selects two attributes to get +4 skill points to allocate.',
				'Can spend 4 AP to reduce any instance of damage taken by half.',
				'Character has a cybernetic harness that allows additional cybernetic implants. Character requires and is addicted to nanotechnology immunosuppressants.'
			]
		},
		{
			id: 'theHunter',
			label: 'The Hunter',
			cost: 1,
			icon: 'fa-solid fa-bullseye',
			description: 'Player starts with a set of hunting knives and a mechanically enforced Bow.',
			details: [
				'Player gets a Bow Weapon (Adroit) Skill at +3 level.',
				'Player gets a Knowledge: Nature Skill and Survival skill at +2 level.'
			]
		},
		{
			id: 'thePsionic',
			label: 'The Psionic',
			cost: 1,
			icon: 'fa-solid fa-brain',
			description:
				'The player is Psionic and gains the Psionic Skill (Mind) at +2 level. They gain a Sixth Sense and supernatural ability that can grow and enhance over time.',
			details: [
				'The player can psionically mend wounds and heal other players.',
				'The player has limited telekinesis of small objects < 10 pounds.'
			]
		}
	],
	points: {
		attributes: 10,
		skills: { body: 20, adroit: 22, mind: 26 },
		abilities: 1
	},
	healthFromAttribute: {
		attributeId: 'body',
		baseValue: 10000,
		atStat: 3,
		perPoint: 2000
	}
};

export const DEFAULT_THEME_ID = 'core';

/** Skill pool per attribute: 2 × listed skills in that category. */
export function getSkillPoolSize(theme: Theme, categoryId: string): number {
	const cat = theme.skills[categoryId];
	if (!cat) return 0;
	return 2 * cat.skills.length;
}

export function knowledgeLabel(presetId: string, detail: string): string {
	const preset = KNOWLEDGE_PRESETS.find((k) => k.id === presetId);
	const base = preset?.label ?? presetId;
	if (detail.trim()) return `${base} (${detail.trim()})`;
	return base;
}
