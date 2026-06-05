import type { Theme } from '../types.js';

export const neonCityTheme: Theme = {
	id: 'neonCity',
	label: 'Neon City (cyberpunk)',
	resourceLabel: 'Luck',
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
				{ id: 'firearms', label: 'Firearms', attribute: 'dexterity' },
				{ id: 'meleeWeapons', label: 'Melee Weapons', attribute: 'strength' },
				{ id: 'unarmed', label: 'Unarmed Combat', attribute: 'strength' },
				{ id: 'dodging', label: 'Dodging', attribute: 'dexterity' },
				{ id: 'blocking', label: 'Blocking', attribute: 'strength' },
				{ id: 'throwing', label: 'Throwing', attribute: 'strength' }
			]
		},
		technology: {
			id: 'technology',
			label: 'Technology',
			skills: [
				{ id: 'hacking', label: 'Hacking', attribute: 'intelligence' },
				{ id: 'electronics', label: 'Electronics', attribute: 'intelligence' },
				{ id: 'cyberware', label: 'Cyberware', attribute: 'intelligence' },
				{ id: 'techRepair', label: 'Tech Repair', attribute: 'dexterity' },
				{ id: 'cyberAwareness', label: 'Cyber Awareness', attribute: 'perception' }
			]
		},
		street: {
			id: 'street',
			label: 'Street',
			skills: [
				{ id: 'streetwise', label: 'Streetwise', attribute: 'perception' },
				{ id: 'stealth', label: 'Stealth', attribute: 'dexterity' },
				{ id: 'lockpicking', label: 'Lockpicking', attribute: 'dexterity' },
				{ id: 'dangerSense', label: 'Danger Sense', attribute: 'perception' },
				{ id: 'intelGathering', label: 'Intel Gathering', attribute: 'intelligence' }
			]
		},
		social: {
			id: 'social',
			label: 'Social',
			alwaysDisplay: true,
			skills: [
				{ id: 'charm', label: 'Charm', attribute: 'rizz' },
				{ id: 'negotiation', label: 'Negotiation', attribute: 'rizz' },
				{ id: 'deception', label: 'Deception', attribute: 'rizz' },
				{ id: 'intimidation', label: 'Intimidation', attribute: 'rizz' },
				{ id: 'insight', label: 'Insight', attribute: 'perception' },
				{ id: 'leadership', label: 'Leadership', attribute: 'rizz' }
			]
		}
	},
	abilities: [
		{ id: 'luckyBreak', label: 'Lucky Break', cost: 3, description: 'Spend 2 Luck: reroll all dice once (first roll only).' },
		{ id: 'overclock', label: 'Overclock', cost: 1, description: 'Spend 2 Luck: roll one extra die on your next action.' },
		{ id: 'ghostProtocol', label: 'Ghost Protocol', cost: 2, description: 'Spend 2 Luck: ignore one detection consequence.' },
		{ id: 'wiredReflexes', label: 'Wired Reflexes', cost: 2, description: 'Spend 2 Luck: partial success on failed Dodge or Block.' },
		{ id: 'deadManSwitch', label: "Dead Man's Switch", cost: 5, description: 'Spend 4 Luck: stay up at 1 Health instead of going down.' },
		{ id: 'secondWind', label: 'Second Wind', cost: 3, description: 'Once per long rest: restore 4 Luck.' },
		{ id: 'loadedDice', label: 'Loaded Dice', cost: 5, description: 'Once per session: change one die (costs 10 Luck).' }
	],
	enhancements: [
		{ id: 'reflexBoosters', label: 'Reflex Boosters', cost: 3, description: 'Once per scene: advantage on Dodging or act first.' },
		{ id: 'subdermalPlating', label: 'Subdermal Plating', cost: 3, description: 'Reduce incoming physical damage.' },
		{ id: 'opticSuite', label: 'Optic Suite', cost: 2, description: 'Bonus to Perception for visual detail.' },
		{ id: 'signalScrubber', label: 'Signal Scrubber', cost: 2, description: 'Harder to track electronically.' },
		{ id: 'toolHand', label: 'Tool-Hand', cost: 2, description: 'Bonus to Lockpicking or Tech Repair.' },
		{ id: 'neuralJack', label: 'Neural Jack', cost: 2, description: 'Bonus to Hacking when jacked-in.' },
		{ id: 'painEditor', label: 'Pain Editor', cost: 3, description: 'Ignore one debuff per long rest.' },
		{ id: 'voiceMask', label: 'Voice Mask', cost: 1, description: 'Bonus to Deception for impersonation.' }
	],
	points: {
		attributes: 18,
		skills: { combat: 6, technology: 7, street: 6, social: 6 },
		abilities: 10
	},
	luckMax: 20,
	healthFromAttribute: {
		attributeId: 'endurance',
		baseValue: 10000,
		atStat: 3,
		perPoint: 2000
	}
};
