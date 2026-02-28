import type { Theme } from './types.js';

export const basicTheme: Theme = {
	id: 'basic',
	label: 'Basic (multi-setting)',
	attributes: [
		{ id: 'strength', label: 'Strength', abbr: 'STR', min: 1, max: 6, default: 2 },
		{ id: 'perception', label: 'Perception', abbr: 'PER', min: 1, max: 6, default: 2 },
		{ id: 'intelligence', label: 'Intelligence', abbr: 'INT', min: 1, max: 6, default: 2 },
		{ id: 'dexterity', label: 'Dexterity', abbr: 'DEX', min: 1, max: 6, default: 2 },
		{ id: 'endurance', label: 'Endurance', abbr: 'END', min: 1, max: 6, default: 3 },
		{ id: 'rizz', label: 'Rizz', abbr: 'RIZ', min: 1, max: 6, default: 2 }
	],
	skills: {
		combat: {
			id: 'combat',
			label: 'Combat',
			alwaysDisplay: true,
			skills: [
				{ id: 'melee', label: 'Melee', attribute: 'strength', description: 'Close-quarters weapons' },
				{ id: 'ranged', label: 'Ranged', attribute: 'dexterity', description: 'Bows, guns, thrown weapons' },
				{ id: 'block', label: 'Block', attribute: 'strength', description: 'Blocking with shield or weapon' },
				{ id: 'defend', label: 'Defend', attribute: 'dexterity', description: 'Dodging, parrying' },
				{ id: 'throwing', label: 'Throwing', attribute: 'dexterity', description: 'Thrown weapons, grenades' }
			]
		},
		adventuring: {
			id: 'adventuring',
			label: 'Adventuring',
			alwaysDisplay: false,
			skills: [
				{ id: 'lockpick', label: 'Lockpick', attribute: 'dexterity' },
				{ id: 'stealth', label: 'Stealth', attribute: 'dexterity' },
				{ id: 'athletics', label: 'Athletics', attribute: 'strength' },
				{ id: 'traps', label: 'Traps', attribute: 'perception', description: 'Find and disarm traps' },
				{ id: 'crafting', label: 'Crafting', attribute: 'intelligence' },
				{ id: 'firstAid', label: 'First Aid', attribute: 'intelligence' },
				{ id: 'scavenging', label: 'Scavenging', attribute: 'perception' },
				{ id: 'animalHandling', label: 'Animal Handling', attribute: 'rizz' },
				{ id: 'insight', label: 'Insight', attribute: 'perception' },
				{ id: 'investigation', label: 'Investigation', attribute: 'intelligence' },
				{ id: 'sleightOfHand', label: 'Sleight of Hand', attribute: 'dexterity' },
				{ id: 'piloting', label: 'Piloting', attribute: 'dexterity', description: 'Vehicles, mounts' },
				{ id: 'acrobatics', label: 'Acrobatics', attribute: 'dexterity' }
			]
		},
		social: {
			id: 'social',
			label: 'Social',
			alwaysDisplay: true,
			skills: [
				{ id: 'persuasion', label: 'Persuasion', attribute: 'rizz' },
				{ id: 'intimidation', label: 'Intimidation', attribute: 'strength' },
				{ id: 'deception', label: 'Deception', attribute: 'rizz' },
				{ id: 'performance', label: 'Performance', attribute: 'rizz', description: 'Acting, music, oration' },
				{ id: 'charm', label: 'Charm', attribute: 'rizz' }
			]
		},
		knowledge: {
			id: 'knowledge',
			label: 'Knowledge',
			alwaysDisplay: false,
			skills: [
				{ id: 'science', label: 'Science', attribute: 'intelligence' },
				{ id: 'history', label: 'History', attribute: 'intelligence' },
				{ id: 'streetwise', label: 'Streetwise', attribute: 'intelligence' },
				{ id: 'religion', label: 'Religion', attribute: 'intelligence' },
				{ id: 'politics', label: 'Politics', attribute: 'intelligence' },
				{ id: 'nature', label: 'Nature', attribute: 'intelligence' },
				{ id: 'survival', label: 'Survival', attribute: 'perception' }
			]
		},
	},
	abilities: [
		{ id: 'extraScoringDie', label: 'Extra Scoring Die', cost: 2, description: 'Spend 3 Fate: your next roll may count 50 points on one additional number.' },
		{ id: 'twistFate', label: 'Twist of Fate', cost: 3, description: 'Spend 3 Fate: roll a D20 on an action and add (roll × 100) to the result.' },
		{ id: 'fateReroll', label: 'Fate Reroll', cost: 1, description: 'Spend 1 Fate: reroll all dice once on the first roll only.' },
		{ id: 'burst', label: 'Burst', cost: 2, description: 'Spend 2 Fate: roll one extra die on your next action (max 6 dice total).' },
		{ id: 'secondWind', label: 'Second Wind', cost: 2, description: 'Once per session: restore 2 Fate (cannot exceed max).' },
		{ id: 'lucky', label: 'Lucky', cost: 6, description: 'Change one die to a number of your choice, once per session and at a cost of 10 Fate.' }
	],
	points: {
		attributes: 18,
		skills: {
			combat: 8,
			adventuring: 10,
			social: 8,
			knowledge: 8
		},
		abilities: 10
	},
	fateMax: 20,
	healthMax: 10,
	/** Health scales with Endurance: 10000 at 3, ±2000 per point */
	healthFromAttribute: {
		attributeId: 'endurance',
		baseValue: 10000,
		atStat: 3,
		perPoint: 2000
	}
};
