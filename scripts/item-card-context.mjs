/**
 * Decorated item payload for `farkpg.item-card` (character sheet + AP drawer).
 *
 * @param {Actor} actor
 * @param {Item} item
 */
export function buildItemCardContext(actor, item) {
    const sys = item.system ?? {};
    const mult = Number(sys.rollable?.multiplier ?? 0);
    const maxv = Number(sys.rollable?.max ?? 0);
    const isWeapon = item.type === "weapon";
    const isConsumable = item.type === "consumable";
    const isEquipment = item.type === "equipment";
    const hasDurability = isWeapon || isEquipment;
    const durabilityPerUse = hasDurability ? Number(sys.durabilityPerUse ?? 0) : 0;
    const usesDurability = durabilityPerUse > 0;
    const durabilityValue = hasDurability ? Number(sys.durability?.value ?? 0) : 0;
    const isBroken = usesDurability && durabilityValue <= 0;
    const ammoEnabled = isWeapon && sys.ammo?.enabled === true;
    const ammoValue = ammoEnabled ? Number(sys.ammo?.value ?? 0) : 0;
    const ammoMax = ammoEnabled ? Number(sys.ammo?.max ?? 0) : 0;
    const reloadFromId = ammoEnabled
        ? String(sys.ammo?.reloadFromId ?? sys.ammo?.linkedConsumableId ?? "")
        : "";
    const reloadSourceItem = reloadFromId ? actor.items.get(reloadFromId) : null;

    const usesRollEnabled = isWeapon || isEquipment || isConsumable;
    const attachedSkill = usesRollEnabled ? String(sys.rollable?.attachedSkill ?? "") : "";
    let rollCount = mult;
    let rollFaces = maxv;
    let attachedSkillLabel = "";
    if (attachedSkill) {
        const [attrKey, skillKey] = attachedSkill.split(".");
        const aVal = Number(actor.system?.attributes?.[attrKey] ?? 0);
        const sVal = Number(actor.system?.skills?.[skillKey] ?? 0);
        rollCount = Math.max(1, aVal + sVal);
        rollFaces = maxv > 0 ? maxv : 6;
        const aLabel = game.i18n.localize(`FARKPG.Attributes.${attrKey}`);
        const sLabel = game.i18n.localize(`FARKPG.Skills.${skillKey}`);
        attachedSkillLabel = `${aLabel} — ${sLabel}`;
    }

    const rollEnabledFlag = sys.rollable?.enabled === true;
    const hasRollFormula = attachedSkill !== "" || (mult > 0 && maxv > 0);
    const isRollable = usesRollEnabled ? rollEnabledFlag : hasRollFormula;
    const iconOnlyRoll = isRollable && !hasRollFormula;

    const consumptionBadges = [];
    if (isRollable && !iconOnlyRoll) {
        if (isWeapon && ammoEnabled) {
            const perUse = Math.max(1, Number(sys.ammo?.perUse ?? 1));
            consumptionBadges.push({
                kind: "ammo",
                icon: "fa-solid fa-crosshairs",
                amount: perUse,
                tooltip: game.i18n.format("FARKPG.Items.badgeAmmoTooltip", { amount: perUse }),
            });
        }
        if (isWeapon) {
            const dpu = Number(sys.durabilityPerUse ?? 0);
            if (dpu > 0) {
                consumptionBadges.push({
                    kind: "durability",
                    icon: "fa-solid fa-screwdriver-wrench",
                    amount: dpu,
                    tooltip: game.i18n.format("FARKPG.Items.badgeDurabilityTooltip", {
                        amount: dpu,
                    }),
                });
            }
        }
        if (isConsumable) {
            consumptionBadges.push({
                kind: "quantity",
                icon: "fa-solid fa-cubes-stacked",
                amount: 1,
                tooltip: game.i18n.localize("FARKPG.Items.badgeQuantityTooltip"),
            });
        }
    }

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
        isBroken,
        brokenTooltip: isBroken
            ? game.i18n.format("FARKPG.Items.brokenTooltip", { name: item.name })
            : "",
        descShort,
        isRollable,
        rollMultiplier: mult,
        rollMax: maxv,
        rollDiceLabel: isRollable && !iconOnlyRoll ? `${rollCount}d` : "",
        rollMultLabel:
            isRollable && !iconOnlyRoll && mult > 0 && maxv > 0 ? `${mult}\u00d7${maxv}` : "",
        iconOnlyRoll,
        useTooltip: iconOnlyRoll
            ? game.i18n.localize("FARKPG.Items.useTooltipOpenTable")
            : mult > 0 && maxv > 0
              ? game.i18n.format("FARKPG.Items.useTooltip", { multiplier: mult, max: maxv })
              : game.i18n.localize("FARKPG.Items.useTooltipSimple"),
        consumptionBadges,
        equipmentSlotsBonus,
        inventorySlotsBonus,
        hasSlotBonus: equipmentSlotsBonus > 0 || inventorySlotsBonus > 0,
        attachedSkill,
        attachedSkillLabel,
        ammoEnabled,
        ammoPerUse: ammoEnabled ? Math.max(1, Number(sys.ammo?.perUse ?? 1)) : 0,
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
        canReload: ammoEnabled && !isBroken && ammoMax > 0 && ammoValue < ammoMax,
        reloadTooltip: ammoEnabled
            ? (() => {
                  if (isBroken)
                      return game.i18n.format("FARKPG.Items.brokenTooltip", { name: item.name });
                  if (ammoMax <= 0) return game.i18n.localize("FARKPG.Items.reloadTooltipUnconfigured");
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
