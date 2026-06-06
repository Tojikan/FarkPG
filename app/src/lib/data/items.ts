import { portraitPublicUrl } from '$lib/data/portrait.js';
import type { InventoryEntry, ItemDamage, ItemFeatures, ItemKind, ItemResourcePair } from './types.js';
import { newLineId } from './character.js';

export const ITEM_KINDS: Array<{ id: ItemKind; label: string }> = [
	{ id: 'consumable', label: 'Consumable' },
	{ id: 'equipment', label: 'Equipment' },
	{ id: 'melee_weapon', label: 'Melee Weapon' },
	{ id: 'ranged_weapon', label: 'Ranged Weapon' }
];

export const ITEM_KIND_META: Record<ItemKind, { label: string; color: string }> = {
	consumable: { label: 'CONSUMABLE', color: '#9b59b6' },
	equipment: { label: 'EQUIPMENT', color: '#2980b9' },
	melee_weapon: { label: 'WEAPON', color: '#e74c3c' },
	ranged_weapon: { label: 'WEAPON', color: '#e74c3c' }
};

export function defaultFeaturesForKind(kind: ItemKind): ItemFeatures {
	switch (kind) {
		case 'melee_weapon':
			return { hasQuantity: false, hasDurability: false, hasAmmo: true, hasDamage: true };
		case 'ranged_weapon':
			return { hasQuantity: false, hasDurability: true, hasAmmo: false, hasDamage: true };
		case 'consumable':
			return { hasQuantity: true, hasDurability: false, hasAmmo: false, hasDamage: false };
		case 'equipment':
			return { hasQuantity: false, hasDurability: true, hasAmmo: false, hasDamage: false };
	}
}

export function defaultDamage(): ItemDamage {
	return { base: 1, additional: 0 };
}

export function defaultResourcePair(current = 0, max = 100): ItemResourcePair {
	return { current, max };
}

export function newItemId(): string {
	return newLineId('item');
}

export function itemImageStoragePath(characterId: string, itemId: string, ext: string): string {
	return `${characterId}/items/${itemId}.${ext}`;
}

export function itemImagePublicUrl(path: string, cacheBust?: string | number): string {
	return portraitPublicUrl(path, cacheBust);
}

function inferKindFromLegacy(entry: InventoryEntry): ItemKind {
	if (entry.itemKind) return entry.itemKind;
	const t = (entry.itemType ?? entry.slot ?? '').toLowerCase();
	if (t.includes('consum')) return 'consumable';
	if (t.includes('melee')) return 'melee_weapon';
	if (t.includes('ranged') || t === 'weapon') return 'ranged_weapon';
	return 'equipment';
}

function parsePairFromStat(value: string | number | undefined): ItemResourcePair | undefined {
	if (value == null) return undefined;
	const text = String(value);
	const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
	if (match) {
		return { current: Number(match[1]), max: Number(match[2]) };
	}
	const num = Number(text);
	if (Number.isFinite(num)) return { current: num, max: num };
	return undefined;
}

function migrateLegacyStats(entry: InventoryEntry): Partial<InventoryEntry> {
	const stats = entry.stats ?? {};
	const patch: Partial<InventoryEntry> = {};
	const lower = Object.fromEntries(
		Object.entries(stats).map(([k, v]) => [k.toLowerCase(), v])
	);

	if (!entry.ammo) {
		const ammo = parsePairFromStat(lower.ammo as string | number | undefined);
		if (ammo) patch.ammo = ammo;
	}
	if (!entry.durability) {
		const durability = parsePairFromStat(lower.durability as string | number | undefined);
		if (durability) patch.durability = durability;
	}
	if (!entry.damage) {
		const damageText = lower.damage;
		if (damageText != null) {
			const text = String(damageText);
			const match = text.match(/(\d+(?:\.\d+)?)(?:\s*\+\s*(\d+(?:\.\d+)?)(x?))?/i);
			if (match) {
				patch.damage = {
					base: Number(match[1]),
					additional: match[2] ? Number(match[2]) : 0
				};
			}
		}
	}

	return patch;
}

export function applyDefaultFieldValues(entry: InventoryEntry): InventoryEntry {
	const next = { ...entry };
	const features = next.features ?? defaultFeaturesForKind(next.itemKind ?? 'equipment');

	if (features.hasQuantity && (next.quantity == null || next.quantity < 1)) {
		next.quantity = 1;
	}
	if (features.hasDurability && !next.durability) {
		next.durability = defaultResourcePair(100, 100);
	}
	if (features.hasAmmo && !next.ammo) {
		next.ammo = defaultResourcePair(0, 20);
	}
	if (features.hasDamage && !next.damage) {
		next.damage = defaultDamage();
	}

	return next;
}

export function normalizeInventoryEntry(entry: InventoryEntry): InventoryEntry {
	const itemKind = inferKindFromLegacy(entry);
	const legacy = migrateLegacyStats(entry);
	const features = entry.features ?? defaultFeaturesForKind(itemKind);

	let normalized: InventoryEntry = {
		...entry,
		...legacy,
		itemKind,
		features,
		quantity: entry.quantity ?? 1,
		equipped: entry.equipped ?? false
	};

	normalized = applyDefaultFieldValues(normalized);
	return normalized;
}

export function sanitizeInventoryEntry(entry: InventoryEntry): InventoryEntry {
	const normalized = normalizeInventoryEntry(entry);
	const features = normalized.features ?? defaultFeaturesForKind(normalized.itemKind ?? 'equipment');

	const cleaned: InventoryEntry = {
		itemId: normalized.itemId,
		label: normalized.label?.trim() || 'Unnamed item',
		description: normalized.description ?? '',
		itemKind: normalized.itemKind ?? 'equipment',
		features,
		equipped: normalized.equipped ?? false,
		...(normalized.imagePath ? { imagePath: normalized.imagePath } : {}),
		...(normalized.imageUpdatedAt ? { imageUpdatedAt: normalized.imageUpdatedAt } : {})
	};

	if (features.hasQuantity) cleaned.quantity = Math.max(1, Math.floor(normalized.quantity ?? 1));
	if (features.hasDurability && normalized.durability) {
		cleaned.durability = {
			current: Math.max(0, normalized.durability.current),
			max: Math.max(1, normalized.durability.max)
		};
	}
	if (features.hasAmmo && normalized.ammo) {
		cleaned.ammo = {
			current: Math.max(0, normalized.ammo.current),
			max: Math.max(1, normalized.ammo.max)
		};
	}
	if (features.hasDamage && normalized.damage) {
		cleaned.damage = {
			base: normalized.damage.base,
			additional: normalized.damage.additional
		};
	}

	return cleaned;
}

export function emptyInventoryEntry(equipped = false): InventoryEntry {
	const itemKind: ItemKind = 'equipment';
	return applyDefaultFieldValues({
		itemId: newItemId(),
		equipped,
		label: '',
		description: '',
		itemKind,
		features: defaultFeaturesForKind(itemKind),
		quantity: 1,
		durability: defaultResourcePair(100, 100)
	});
}

export function itemKindMeta(entry: InventoryEntry) {
	const kind = entry.itemKind ?? 'equipment';
	return ITEM_KIND_META[kind] ?? ITEM_KIND_META.equipment;
}

	export function formatDamage(damage: ItemDamage): string {
	if (damage.additional > 0) {
		return `${damage.base} + ${damage.additional}x`;
	}
	return String(damage.base);
}

export function getItemDisplayStats(
	entry: InventoryEntry
): Array<{ key: string; value: string; icon: string }> {
	const e = normalizeInventoryEntry(entry);
	const rows: Array<{ key: string; value: string; icon: string }> = [];
	const features = e.features ?? {};

	if (features.hasQuantity) {
		rows.push({ key: 'QTY', value: String(e.quantity ?? 1), icon: 'fa-solid fa-layer-group' });
	}
	if (features.hasAmmo && e.ammo) {
		rows.push({
			key: 'AMMO',
			value: `${e.ammo.current}/${e.ammo.max}`,
			icon: 'fa-solid fa-bullseye'
		});
	}
	if (features.hasDamage && e.damage) {
		rows.push({
			key: 'DAMAGE',
			value: formatDamage(e.damage),
			icon: 'fa-solid fa-burst'
		});
	}
	if (features.hasDurability && e.durability) {
		rows.push({
			key: 'DURABILITY',
			value: `${e.durability.current}/${e.durability.max}`,
			icon: 'fa-solid fa-wrench'
		});
	}

	return rows;
}

export function itemDisplayName(entry: InventoryEntry): string {
	return entry.label?.trim() || 'Unnamed item';
}

export function itemImageUrl(entry: InventoryEntry): string | null {
	if (!entry.imagePath) return null;
	return itemImagePublicUrl(entry.imagePath, entry.imageUpdatedAt);
}
