import type { Theme } from '../types.js';

/** ZnZ zombie survival theme (3 attributes, core skills per attribute). */
export const znzTheme: Theme = {
	id: 'znz',
	label: 'ZnZ (zombie survival)',
	resourceLabel: 'AP',
	attributes: [
		{ id: 'body', label: 'Body', abbr: 'BOD', min: 1, max: 6, default: 3 },
		{ id: 'adroit', label: 'Adroit', abbr: 'ADR', min: 1, max: 6, default: 3 },
		{ id: 'mind', label: 'Mind', abbr: 'MND', min: 1, max: 6, default: 3 }
	],
	skills: {
		body: {
			id: 'body',
			label: 'Body Skills',
			alwaysDisplay: true,
			skills: [
				{ id: 'meleeWeapons', label: 'Melee Weapons', attribute: 'body' },
				{ id: 'block', label: 'Block', attribute: 'body' },
				{ id: 'unarmed', label: 'Unarmed', attribute: 'body' },
				{ id: 'endurance', label: 'Endurance', attribute: 'body' },
				{ id: 'athletics', label: 'Athletics', attribute: 'body' }
			]
		},
		adroit: {
			id: 'adroit',
			label: 'Adroit Skills',
			alwaysDisplay: true,
			skills: [
				{ id: 'rangedWeapons', label: 'Ranged Weapons', attribute: 'adroit' },
				{ id: 'dodge', label: 'Dodge', attribute: 'adroit' },
				{ id: 'throwing', label: 'Throwing', attribute: 'adroit' },
				{ id: 'coordination', label: 'Coordination', attribute: 'adroit' },
				{ id: 'stealth', label: 'Stealth', attribute: 'adroit' }
			]
		},
		mind: {
			id: 'mind',
			label: 'Mind Skills',
			alwaysDisplay: true,
			skills: [
				{ id: 'charisma', label: 'Charisma', attribute: 'mind' },
				{ id: 'intelligence', label: 'Intelligence', attribute: 'mind' },
				{ id: 'perception', label: 'Perception', attribute: 'mind' },
				{ id: 'sanity', label: 'Sanity', attribute: 'mind' },
				{ id: 'instinct', label: 'Instinct', attribute: 'mind' }
			]
		}
	},
	abilities: [],
	points: {
		attributes: 30,
		skills: { body: 0, adroit: 0, mind: 0 },
		abilities: 0
	},
	healthFromAttribute: {
		attributeId: 'body',
		baseValue: 10000,
		atStat: 3,
		perPoint: 2000
	}
};

export function getZnzMovement(attributes: Record<string, number>): number {
	const adroit = attributes.adroit ?? 3;
	return 20 + (adroit - 3) * 5;
}

export function getZnzActionPointsMax(attributes: Record<string, number>): number {
	const mind = attributes.mind ?? 3;
	return 18 + (mind - 3) * 2;
}
