/** Font Awesome icon classes for builder skill rows */
export const SKILL_ICONS: Record<string, string> = {
	strength: 'fa-solid fa-dumbbell',
	endurance: 'fa-solid fa-shield-heart',
	throwing: 'fa-solid fa-baseball',
	meleeCombat: 'fa-solid fa-khanda',
	block: 'fa-solid fa-shield-halved',
	athletics: 'fa-solid fa-person-running',
	acrobatics: 'fa-solid fa-person-falling',
	parkour: 'fa-solid fa-stairs',
	cardio: 'fa-solid fa-heart-pulse',
	grappling: 'fa-solid fa-hand-fist',
	rangedCombat: 'fa-solid fa-crosshairs',
	dodging: 'fa-solid fa-wind',
	stealth: 'fa-solid fa-user-secret',
	coordination: 'fa-solid fa-bullseye',
	crafting: 'fa-solid fa-hammer',
	trapmaking: 'fa-solid fa-link',
	thievery: 'fa-solid fa-key',
	piloting: 'fa-solid fa-jet-fighter-up',
	sleightOfHand: 'fa-solid fa-hand-sparkles',
	survival: 'fa-solid fa-campground',
	zeroGManeuvering: 'fa-solid fa-user-astronaut',
	charisma: 'fa-solid fa-comments',
	intellect: 'fa-solid fa-lightbulb',
	insight: 'fa-solid fa-eye',
	perception: 'fa-solid fa-magnifying-glass',
	sanity: 'fa-solid fa-brain',
	instinct: 'fa-solid fa-bolt',
	investigation: 'fa-solid fa-user-secret',
	navigation: 'fa-solid fa-compass',
	hacking: 'fa-solid fa-laptop-code',
	medical: 'fa-solid fa-kit-medical',
	aura: 'fa-solid fa-sun',
	knowledge: 'fa-solid fa-book',
	shipOperations: 'fa-solid fa-ship',
	custom: 'fa-solid fa-star'
};

export function skillIconClass(skillId: string): string {
	return SKILL_ICONS[skillId] ?? 'fa-solid fa-circle-dot';
}
