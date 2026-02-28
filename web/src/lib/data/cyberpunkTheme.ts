import type { Theme } from './types.js';

export const neonCityTheme: Theme = {
	id: 'neonCity',
	label: 'Neon City (cyberpunk)',
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
				{ id: 'firearms', label: 'Firearms', attribute: 'dexterity', description: 'Pistols, SMGs, rifles, shotguns' },
				{ id: 'meleeWeapons', label: 'Melee Weapons', attribute: 'strength', description: 'Blades, clubs, improvised weapons' },
				{ id: 'unarmed', label: 'Unarmed Combat', attribute: 'strength', description: 'Brawling, grappling, holds' },
				{ id: 'dodging', label: 'Dodging', attribute: 'dexterity', description: 'Evasion, diving for cover, staying mobile' },
				{ id: 'blocking', label: 'Blocking', attribute: 'strength', description: 'Parries, bracing, stopping a hit' },
				{ id: 'throwing', label: 'Throwing', attribute: 'strength', description: 'Knives, bottles, grenades, quick tosses' }
			]
		},

		technology: {
			id: 'technology',
			label: 'Technology',
			alwaysDisplay: false,
			skills: [
				{ id: 'hacking', label: 'Hacking', attribute: 'intelligence', description: 'Breaking in, spoofing, quickhacks' },
				{ id: 'electronics', label: 'Electronics', attribute: 'intelligence', description: 'Wiring, circuits, devices, bypasses' },
				{ id: 'cyberware', label: 'Cyberware', attribute: 'intelligence', description: 'Mods, tuning, calibration, safe use' },
				{ id: 'techRepair', label: 'Tech Repair', attribute: 'dexterity', description: 'Fixing gear under pressure, field repairs' },
				{ id: 'cyberAwareness', label: 'Cyber Awareness', attribute: 'perception', description: 'Spot trackers, hidden cams, jammers, “something’s on the net”' }
			]
		},

		street: {
			id: 'street',
			label: 'Street',
			alwaysDisplay: false,
			skills: [
				{ id: 'streetwise', label: 'Streetwise', attribute: 'perception', description: 'Rumors, routes, reading neighborhoods' },
				{ id: 'stealth', label: 'Stealth', attribute: 'dexterity', description: 'Sneaking, tailing, staying unseen' },
				{ id: 'lockpicking', label: 'Lockpicking', attribute: 'dexterity', description: 'Locks, doors, cuffs, quick entry' },
				{ id: 'dangerSense', label: 'Danger Sense', attribute: 'perception', description: 'Ambush tells, bad vibes, imminent trouble' },
				{ id: 'powerStructures', label: 'Power Structure Knowledge', attribute: 'intelligence', description: 'Corpos, gangs, syndicates, politics, who owns what' }
			]
		},

		social: {
			id: 'social',
			label: 'Social',
			alwaysDisplay: true,
			skills: [
				{ id: 'charm', label: 'Charm', attribute: 'rizz', description: 'Warmth, likability, first impressions' },
				{ id: 'negotiation', label: 'Negotiation', attribute: 'rizz', description: 'Deals, leverage, squeezing terms' },
				{ id: 'deception', label: 'Deception', attribute: 'rizz', description: 'Lies, covers, confidence games' },
				{ id: 'intimidation', label: 'Intimidation', attribute: 'rizz', description: 'Pressure, menace, making it hurt without swinging' },
				{ id: 'insight', label: 'Insight', attribute: 'perception', description: 'Reading motives, spotting lies, social tells' },
				{ id: 'leadership', label: 'Leadership', attribute: 'rizz', description: 'Coordination, morale, keeping the crew moving' }
			]
		}
	},

	// Luck replaces Fate in Neon City
	abilities: [
		{ id: 'luckyBreak', label: 'Lucky Break', cost: 2, description: 'Spend 2 Luck: reroll all dice once (first roll only).' },
		{ id: 'overclock', label: 'Overclock', cost: 2, description: 'Spend 2 Luck: roll one extra die on your next action (max 6 dice total).' },
		{ id: 'ghostProtocol', label: 'Ghost Protocol', cost: 2, description: 'Spend 2 Luck: ignore one detection/alert consequence from a Tech or Street action.' },
		{ id: 'wiredReflexes', label: 'Wired Reflexes', cost: 2, description: 'Spend 2 Luck: treat a failed Dodge or Block as a partial success (reduced consequence).' },
		{ id: 'deadManSwitch', label: 'Dead Man’s Switch', cost: 3, description: 'Spend 4 Luck: when you would go down, stay up at 1 Health instead (once per session).' },
		{ id: 'secondWind', label: 'Second Wind', cost: 2, description: 'Once per session: restore 2 Luck (cannot exceed max).' },
		{ id: 'loadedDice', label: 'Loaded Dice', cost: 6, description: 'Once per session: change one die to a number of your choice (costs 10 Luck to use).' }
	],
	enhancements: [
		{
			id: 'reflexBoosters',
			label: 'Reflex Boosters',
			cost: 3,
			description: 'Once per scene: gain advantage on Dodging OR act first in a tense moment (GM call).'
		},
		{
			id: 'subdermalPlating',
			label: 'Subdermal Plating',
			cost: 3,
			description: 'Reduce incoming physical damage by a small amount (or downgrade one consequence step once per scene).'
		},
		{
			id: 'opticSuite',
			label: 'Optic Suite',
			cost: 2,
			description: 'Zoom/low-light/thermal toggles. Bonus to Perception checks involving visual detail.'
		},
		{
			id: 'signalScrubber',
			label: 'Signal Scrubber',
			cost: 2,
			description: 'Harder to track. Bonus to Tech Awareness vs trackers and passive surveillance.'
		},
		{
			id: 'toolHand',
			label: 'Tool-Hand',
			cost: 2,
			description: 'Built-in microtools. Bonus to Lockpicking or Tech Repair when you’re not properly equipped.'
		},
		{
			id: 'neuralJack',
			label: 'Neural Jack',
			cost: 2,
			description: 'Faster interface. Bonus to Hacking when jacked-in or directly wired.'
		},
		{
			id: 'painEditor',
			label: 'Pain Editor',
			cost: 3,
			description: 'Ignore one “stun/pain” style penalty per scene; Endurance checks vs shock are easier.'
		},
		{
			id: 'voiceMask',
			label: 'Voice Mask',
			cost: 1,
			description: 'On-demand voice shift. Bonus to Deception for impersonation and calls.'
		}
	],

	points: {
		attributes: 18,
		skills: {
			combat: 6,
			technology: 7,
			street: 6,
			social: 6
		},
		abilities: 10
	},

	luckMax: 20,
	healthMax: 10,

	/** Health scales with Endurance: 10000 at 3, ±2000 per point */
	healthFromAttribute: {
		attributeId: 'endurance',
		baseValue: 10000,
		atStat: 3,
		perPoint: 2000
	}
};