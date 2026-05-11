/* global foundry, game */

import {
  ADROIT_SKILLS,
  ATTR_VALUE_MAX,
  BODY_SKILLS,
  DEFAULT_CHARACTER_ATTRIBUTES,
  MIND_SKILLS,
  SKILL_VALUE_MAX
} from "./config.mjs";
import { normalizeSheetSystem } from "./actor-system.mjs";

export function skillGroupsFromSystem(sys) {
  normalizeSheetSystem(sys);
  const s = sys;
  const attrs = s.attributes ?? DEFAULT_CHARACTER_ATTRIBUTES;
  const customsIndexed = [...(s.customSkills ?? [])].map((row, idx) => ({
    id: row.id,
    attrKey: row.attrKey,
    label: row.label,
    value: row.value,
    _index: idx
  }));
  const customFor = (attrKey) => customsIndexed.filter((c) => c.attrKey === attrKey);
  const mk = (key, attrKey, skillKeys) => ({
    key,
    attrKey,
    label: game.i18n.localize(`FARKPG.Attributes.${attrKey}.label`),
    hint: game.i18n.localize(`FARKPG.Attributes.${attrKey}.hint`),
    attrValue: Math.max(
      0,
      Math.min(ATTR_VALUE_MAX, Number(attrs[attrKey] ?? DEFAULT_CHARACTER_ATTRIBUTES[attrKey] ?? 0) || 0)
    ),
    skills: skillKeys.map((sk) => ({
      key: sk,
      label: game.i18n.localize(`FARKPG.Skills.${sk}.label`),
      hint: game.i18n.localize(`FARKPG.Skills.${sk}.hint`),
      value: Math.max(0, Math.min(SKILL_VALUE_MAX, Number(s.skills[sk]) || 0)),
      attrKey
    })),
    customSkills: customFor(attrKey)
  });
  return [
    mk("body", "body", BODY_SKILLS),
    mk("adroit", "adroit", ADROIT_SKILLS),
    mk("mind", "mind", MIND_SKILLS)
  ];
}

export function inventoryGear(actor) {
  return actor.items.filter((i) => ["weapon", "consumable", "equipment"].includes(i.type));
}

export function inventoryCount(actor) {
  return inventoryGear(actor).length;
}

export function abilityItems(actor) {
  return actor.items.filter((i) => i.type === "ability");
}

export function gearIsEquipped(item) {
  return item?.system?.isEquipped === true;
}

/** Equipped stash items sorted by Foundry ordering (creation / sort index). */
export function equippedGearSorted(actor) {
  return inventoryGear(actor)
    .filter(gearIsEquipped)
    .sort((a, b) => ((a.sort ?? 0) - (b.sort ?? 0)));
}

/** Takes up equipment slots — first slotCount flagged items in sorted order; overflow appears in stash. */
export function equippedSlotItems(actor, sys) {
  const max = Math.max(1, Number(sys.equipment?.slotCount) || 2);
  return equippedGearSorted(actor).slice(0, max);
}

/** Item ids occupying the actor's equipped slots today (shown on Character tab). */
export function equippedSlotIdSet(actor, sys) {
  return new Set(equippedSlotItems(actor, sys).map((i) => i.id));
}

/** How many gear items currently say they are equipped (can exceed slots). */
export function equippedGearCount(actor) {
  return inventoryGear(actor).filter(gearIsEquipped).length;
}

export function itemDetailSnippet(item) {
  if (item.type === "consumable") {
    return String(item.system.quantity?.value ?? "");
  }
  const dmax = item.system.durability?.max ?? 0;
  if (dmax > 0) return `${item.system.durability?.value ?? 0}/${dmax}`;
  return "";
}

export function equippedPanel(actor, sys) {
  return equippedSlotItems(actor, sys).map((it) => ({
    id: it.id,
    name: it.name,
    img: it.img ?? "icons/svg/item-bag.svg",
    typeLoc: `TYPES.Item.${it.type}`
  }));
}

export function inventoryRowModel(actor, sys) {
  const slotOccupiedIds = equippedSlotIdSet(actor, sys);
  return inventoryGear(actor)
    .filter((item) => !slotOccupiedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      img: item.img ?? "icons/svg/item-bag.svg",
      typeLoc: `TYPES.Item.${item.type}`,
      detail: itemDetailSnippet(item)
    }));
}

export async function stripEquipped(actor, itemId) {
  const item = actor?.items?.get(itemId);
  if (item?.system && gearIsEquipped(item)) await item.update({ "system.isEquipped": false });
}
