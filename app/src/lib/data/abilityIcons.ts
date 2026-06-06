/** Font Awesome icon classes for theme starting abilities */
export const ABILITY_ICONS: Record<string, string> = {
	cyborgArm: 'fa-solid fa-hand-fist',
	mostlyMachine: 'fa-solid fa-robot',
	theHunter: 'fa-solid fa-bullseye',
	thePsionic: 'fa-solid fa-brain'
};

export function abilityIconClass(abilityId: string, fallback?: string): string {
	return ABILITY_ICONS[abilityId] ?? fallback ?? 'fa-solid fa-star';
}
