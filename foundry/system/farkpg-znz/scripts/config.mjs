/**
 * Static configuration data for FarkPG-ZnZ.
 * Imported by both the main entry module and the actor sheet.
 */

export const SYSTEM_ID = "farkpg-znz";

/**
 * Each attribute lists the built-in skills that belong to it, in display order.
 * Skill keys must match `template.json` `Actor.character.skills.*`.
 * @type {Record<"body"|"adroit"|"mind", string[]>}
 */
export const ATTRIBUTE_SKILLS = {
    body: ["meleeWeapons", "block", "unarmed", "endurance", "athletics"],
    adroit: ["rangedWeapons", "dodge", "throwing", "coordination", "stealth"],
    mind: ["charisma", "intelligence", "perception", "sanity", "instinct"],
};

export const ATTRIBUTE_KEYS = /** @type {("body"|"adroit"|"mind")[]} */ (
    Object.keys(ATTRIBUTE_SKILLS)
);

/**
 * Item types that may appear in the Inventory tab's "Add" buttons.
 * Order controls button order.
 */
export const INVENTORY_ITEM_TYPES = ["weapon", "consumable", "equipment", "ability"];
