import { formatDamageLabel, getItemDamageFields } from "./weapon-damage.mjs";

/**
 * Decorated item payload for `farkpg.item-card` (character sheet + AP drawer).
 *
 * @param {Actor} actor
 * @param {Item} item
 */
export function buildItemCardContext(actor, item) {
    const sys = item.system ?? {};
    const isWeapon = item.type === "weapon";
    const isConsumable = item.type === "consumable";
    const isEquipment = item.type === "equipment";
    const rollEnabledFlag = sys.rollable?.enabled === true;

    const durabilityEnabled =
        (isWeapon || isEquipment) && sys.durabilityEnabled === true;
    const hasDurability = durabilityEnabled;
    const durabilityValue = hasDurability ? Number(sys.durability?.value ?? 0) : 0;
    const durabilityMax = hasDurability ? Number(sys.durability?.max ?? 0) : 0;
    const usesDurability = durabilityEnabled;
    const isBroken = usesDurability && durabilityValue <= 0;

    const ammoEnabled = isWeapon && sys.ammo?.enabled === true;
    const reloadEnabled = ammoEnabled && sys.ammo?.reloadEnabled === true;
    const restoreEnabled = durabilityEnabled && sys.restoreEnabled === true;
    const ammoValue = ammoEnabled ? Number(sys.ammo?.value ?? 0) : 0;
    const ammoMax = ammoEnabled ? Number(sys.ammo?.max ?? 0) : 0;
    const reloadFromId = reloadEnabled
        ? String(sys.ammo?.reloadFromId ?? sys.ammo?.linkedConsumableId ?? "")
        : "";
    const reloadSourceItem = reloadFromId ? actor.items.get(reloadFromId) : null;
    const restoreFromId = restoreEnabled ? String(sys.restoreFromId ?? "") : "";
    const restoreSourceItem = restoreFromId ? actor.items.get(restoreFromId) : null;

    const { base: damageBase, additional: damageAdditional } = getItemDamageFields(sys);
    const showDamage = rollEnabledFlag && (damageBase > 0 || damageAdditional > 0);

    const attachedSkill = rollEnabledFlag ? String(sys.rollable?.attachedSkill ?? "") : "";
    const hasRollFormula =
        rollEnabledFlag &&
        (attachedSkill !== "" || damageBase > 0 || damageAdditional > 0);
    const isRollable = rollEnabledFlag;
    const iconOnlyRoll = isRollable && !hasRollFormula;

    const equipmentSlotsBonus = isEquipment ? Number(sys.equipmentSlots ?? 0) : 0;
    const inventorySlotsBonus = isEquipment ? Number(sys.inventorySlots ?? 0) : 0;

    const rawDesc = String(sys.description ?? "");
    const descText = rawDesc
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const descShort = descText.length > 140 ? `${descText.slice(0, 137)}…` : descText;

    return {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`),
        system: sys,
        isWeapon,
        isConsumable,
        isEquipment,
        hasDurability,
        usesDurability,
        durabilityEnabled,
        durabilityValue,
        durabilityMax,
        isBroken,
        brokenTooltip: isBroken
            ? game.i18n.format("FARKPG.Items.brokenTooltip", { name: item.name })
            : "",
        descShort,
        isRollable,
        showDamage,
        damageLabel: formatDamageLabel(damageBase, damageAdditional),
        damageBase,
        damageAdditional,
        iconOnlyRoll,
        useTooltip: iconOnlyRoll
            ? game.i18n.localize("FARKPG.Items.useTooltipOpenTable")
            : game.i18n.localize("FARKPG.Items.useTooltipWeapon"),
        equipmentSlotsBonus,
        inventorySlotsBonus,
        hasSlotBonus: equipmentSlotsBonus > 0 || inventorySlotsBonus > 0,
        attachedSkill,
        ammoEnabled,
        reloadEnabled,
        restoreEnabled,
        hasSupplyRow: reloadEnabled || restoreEnabled,
        ammoValue,
        ammoMax,
        reloadSource: reloadSourceItem
            ? {
                  id: reloadSourceItem.id,
                  name: reloadSourceItem.name,
                  img: reloadSourceItem.img,
                  qty: Number(reloadSourceItem.system?.quantity?.value ?? 0),
              }
            : null,
        restoreSource: restoreSourceItem
            ? {
                  id: restoreSourceItem.id,
                  name: restoreSourceItem.name,
                  img: restoreSourceItem.img,
                  qty: Number(restoreSourceItem.system?.quantity?.value ?? 0),
              }
            : null,
        canReload:
            reloadEnabled && !isBroken && ammoMax > 0 && ammoValue < ammoMax,
        reloadTooltip: reloadEnabled
            ? (() => {
                  if (isBroken)
                      return game.i18n.format("FARKPG.Items.brokenTooltip", { name: item.name });
                  if (ammoMax <= 0)
                      return game.i18n.localize("FARKPG.Items.reloadTooltipUnconfigured");
                  if (ammoValue >= ammoMax)
                      return game.i18n.format("FARKPG.Items.reloadTooltipFull", {
                          name: item.name,
                          value: ammoValue,
                          max: ammoMax,
                      });
                  return game.i18n.format("FARKPG.Items.reloadTooltip", {
                      name: item.name,
                      source: reloadSourceItem?.name ?? "—",
                      need: ammoMax - ammoValue,
                  });
              })()
            : "",
        canRestore:
            restoreEnabled &&
            !isBroken &&
            durabilityMax > 0 &&
            durabilityValue < durabilityMax,
        restoreTooltip: restoreEnabled
            ? (() => {
                  if (durabilityMax <= 0)
                      return game.i18n.localize("FARKPG.Items.restoreTooltipUnconfigured");
                  if (durabilityValue >= durabilityMax)
                      return game.i18n.format("FARKPG.Items.restoreTooltipFull", {
                          name: item.name,
                          value: durabilityValue,
                          max: durabilityMax,
                      });
                  return game.i18n.format("FARKPG.Items.restoreTooltip", {
                      name: item.name,
                      source: restoreSourceItem?.name ?? "—",
                      need: durabilityMax - durabilityValue,
                  });
              })()
            : "",
    };
}

/** @param {Actor} actor */
export function buildEquippedItemCards(actor) {
    const isAbility = (i) => i.type === "ability";
    const isEquipped = (i) => !isAbility(i) && i.system?.isEquipped === true;
    return actor.items.contents
        .filter(isEquipped)
        .sort((a, b) => a.sort - b.sort)
        .map((item) => buildItemCardContext(actor, item));
}
