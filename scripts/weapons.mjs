/* global foundry, game, ui */

import { rollSkill } from "./rolls.mjs";

export async function useWeapon(item) {
  const actor = item.actor;
  if (!actor) {
    ui.notifications.warn("Weapon must belong to an actor.");
    return null;
  }
  if (item.type !== "weapon") {
    ui.notifications.warn("Not a weapon item.");
    return null;
  }
  const sys = item.system;
  const ammo = sys.ammo;
  if (ammo?.enabled) {
    if (!ammo.linkedConsumableId) {
      ui.notifications.warn("Ammo is on: choose a consumable on this weapon (same actor).");
      return null;
    }
    const cons = actor.items.get(ammo.linkedConsumableId);
    if (!cons || cons.type !== "consumable") {
      ui.notifications.warn("Linked ammo must be a consumable on the same character.");
      return null;
    }
    const q = cons.system.quantity?.value ?? 0;
    const per = Math.max(1, ammo.perUse ?? 1);
    if (q < per) {
      ui.notifications.warn("Not enough ammo (consumable quantity).");
      return null;
    }
    await cons.update({ "system.quantity.value": q - per });
  }
  const style =
    sys.weaponStyle === "ranged"
      ? { attr: "adroit", skill: "rangedWeapons" }
      : { attr: "body", skill: "meleeWeapons" };
  return rollSkill(actor, style.attr, style.skill, {
    label: `${item.name} (${game.i18n.localize("FARKPG.UseWeapon")})`
  });
}

export async function useWeaponById(actorId, itemId) {
  const actor = game.actors.get(actorId);
  const item = actor?.items.get(itemId);
  if (!actor || !item) {
    ui.notifications.warn("Actor or item not found.");
    return null;
  }
  return useWeapon(item);
}
