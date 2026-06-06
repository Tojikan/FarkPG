import type { CharacterData, InventoryEntry, Theme } from './types.js';
import { newLineId } from './character.js';
import { abilityIconClass } from './abilityIcons.js';
import { portraitPublicUrl } from './portrait.js';

export const EQUIP_SLOTS = [
	{ id: 'weapon', label: 'WEAPON', color: '#c0392b' },
	{ id: 'off_hand', label: 'OFF HAND', color: '#e67e22' },
	{ id: 'head', label: 'HEAD', color: '#7b68ee' },
	{ id: 'body', label: 'BODY', color: '#2980b9' },
	{ id: 'feet', label: 'FEET', color: '#27ae60' },
	{ id: 'accessory', label: 'ACCESSORY', color: '#95a5a6' }
] as const;

export const MAX_EQUIPMENT_SLOTS = 6;
export const MAX_INVENTORY_SLOTS = 24;
export const MAX_ABILITY_SLOTS = 6;
export const DEFAULT_XP_MAX = 3500;

export const CATEGORY_STYLES: Record<string, { accent: string; bg: string }> = {
	body: { accent: '#c0392b', bg: 'rgba(192, 57, 43, 0.12)' },
	adroit: { accent: '#27ae60', bg: 'rgba(39, 174, 96, 0.12)' },
	mind: { accent: '#2980b9', bg: 'rgba(41, 128, 185, 0.12)' }
};

export function newItemId(): string {
	return newLineId('item');
}

export function getSlotMeta(slot: string | null | undefined) {
	const found = EQUIP_SLOTS.find((s) => s.id === slot);
	return found ?? { id: 'other', label: 'ITEM', color: '#95a5a6' };
}

export function abilityImageStoragePath(characterId: string, abilityId: string, ext: string): string {
	return `${characterId}/abilities/${abilityId}.${ext}`;
}

export function abilityImagePublicUrl(path: string, cacheBust?: string | number): string {
	return portraitPublicUrl(path, cacheBust);
}

export function inferAbilityKind(description: string): 'passive' | 'active' {
	return /^passive:/i.test(description.trim()) ? 'passive' : 'active';
}

export function getEquippedItems(inventory: InventoryEntry[] = []): InventoryEntry[] {
	return inventory.filter((entry) => entry.equipped);
}

export function getUnequippedItems(inventory: InventoryEntry[] = []): InventoryEntry[] {
	return inventory.filter((entry) => !entry.equipped);
}

export interface DisplayAbility {
	id: string;
	label: string;
	description: string;
	details?: string[];
	icon: string;
	imageUrl?: string | null;
	source: 'theme' | 'custom';
}

export function getDisplayAbilities(data: CharacterData, theme: Theme): DisplayAbility[] {
	const list: DisplayAbility[] = [];
	const themeById = new Map(theme.abilities.map((ab) => [ab.id, ab]));

	for (const ab of theme.abilities) {
		if ((data.abilities[ab.id] ?? 0) <= 0) continue;
		list.push({
			id: ab.id,
			label: ab.label,
			description: ab.description.replace(/^passive:\s*/i, ''),
			details: ab.details,
			icon: ab.icon ?? abilityIconClass(ab.id),
			source: 'theme'
		});
	}

	for (const ab of data.custom?.abilities ?? []) {
		const themeAb = themeById.get(ab.id);
		list.push({
			id: ab.id,
			label: ab.label,
			description: ab.description.replace(/^passive:\s*/i, ''),
			details: themeAb?.details,
			icon: themeAb?.icon ?? abilityIconClass(ab.id),
			imageUrl: ab.imagePath ? abilityImagePublicUrl(ab.imagePath, ab.imageUpdatedAt) : null,
			source: 'custom'
		});
	}

	return list;
}

export function emptyCustomAbility() {
	return {
		id: newLineId('ab'),
		label: '',
		description: ''
	};
}
