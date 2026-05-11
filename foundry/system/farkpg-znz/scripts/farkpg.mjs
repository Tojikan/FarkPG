import { SYSTEM_ID } from "./config.mjs";
import { FarkPGApDrawer } from "./ap-drawer.mjs";
import { FarkPGCharacterSheet } from "./sheets/character-sheet.mjs";
import { FarkPGItemSheet } from "./sheets/item-sheet.mjs";

Hooks.once("init", async () => {
    CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
    if (!Handlebars.helpers.gt) {
        Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
    }
    if (!Handlebars.helpers.and) {
        Handlebars.registerHelper("and", (...args) => {
            // Trailing argument is the Handlebars options object.
            const values = args.slice(0, -1);
            return values.every((v) => !!v);
        });
    }

    const { DocumentSheetConfig } = foundry.applications.apps;

    DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, FarkPGCharacterSheet, {
        types: ["character"],
        makeDefault: true,
        label: "FARKPG.Title",
    });

    DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, FarkPGItemSheet, {
        types: ["weapon", "consumable", "equipment", "ability"],
        makeDefault: true,
        label: "FARKPG.Title",
    });

    await foundry.applications.handlebars.loadTemplates({
        "farkpg.header": `systems/${SYSTEM_ID}/templates/actor/parts/header.hbs`,
        "farkpg.tabs": `systems/${SYSTEM_ID}/templates/actor/parts/tabs.hbs`,
        "farkpg.tab-character": `systems/${SYSTEM_ID}/templates/actor/parts/tab-character.hbs`,
        "farkpg.tab-inventory": `systems/${SYSTEM_ID}/templates/actor/parts/tab-inventory.hbs`,
        "farkpg.tab-config": `systems/${SYSTEM_ID}/templates/actor/parts/tab-config.hbs`,
        "farkpg.item-card": `systems/${SYSTEM_ID}/templates/actor/parts/item-card.hbs`,
        "farkpg.ap-drawer": `systems/${SYSTEM_ID}/templates/ap-drawer.hbs`,
    });
});

Hooks.on("updateActor", (actor) => {
    if (actor.type !== "character") return;
    FarkPGApDrawer.refreshIfOpen(actor.id);
});

/**
 * Default-attached-skill map for weapons (keyed by `weaponStyle`) and a single
 * fallback for equipment. Used by the `preUpdateItem` hook below.
 */
const DEFAULT_ATTACHED_SKILL = {
    weapon: {
        melee: "body.meleeWeapons",
        ranged: "adroit.rangedWeapons",
        thrown: "adroit.throwing",
        unarmed: "body.unarmed",
    },
    equipment: "body.block",
};

/**
 * On the first `rollable.enabled` false → true transition, prefill an
 * `attachedSkill` based on the item type / weapon style so users get a sensible
 * default without having to pick from the dropdown every time.
 *
 * Only fires when the transition has no explicit `attachedSkill` in the change
 * payload AND no value already stored on the item, so subsequent toggles and
 * manual selections are preserved.
 */

/**
 * Delegate clicks on the "Open Virtual Dice Table" button rendered inside our
 * Fark-roll chat messages. Using a single document-level listener avoids
 * having to attach handlers per message-render and works with both v12's
 * `renderChatMessage` and v13's `renderChatMessageHTML` hooks.
 */
Hooks.once("ready", () => {
    document.addEventListener(
        "click",
        (event) => {
            const btn = event.target?.closest?.(
                "[data-farkpg-action='open-virtual-table']",
            );
            if (!btn) return;
            event.preventDefault();
            const api = game.modules.get("virtual-dice-table")?.api;
            if (api?.openVirtualTable) {
                api.openVirtualTable();
                return;
            }
            const direct = globalThis.virtualDiceTable;
            if (direct?.openVirtualTable) {
                direct.openVirtualTable();
                return;
            }
            if (direct?.open) {
                direct.open();
                return;
            }
            ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.dicetableMissing"));
        },
        { capture: false },
    );
});

Hooks.on("preUpdateItem", (item, changes) => {
    if (item.type !== "weapon" && item.type !== "equipment") return;

    const newEnabled = foundry.utils.getProperty(changes, "system.rollable.enabled");
    if (newEnabled !== true) return;

    const wasEnabled = item.system?.rollable?.enabled === true;
    if (wasEnabled) return;

    const explicitSkill = foundry.utils.getProperty(changes, "system.rollable.attachedSkill");
    const currentSkill = String(item.system?.rollable?.attachedSkill ?? "");
    const finalSkill = explicitSkill !== undefined ? String(explicitSkill ?? "") : currentSkill;
    if (finalSkill) return;

    let defaultSkill = "";
    if (item.type === "weapon") {
        const style = String(
            foundry.utils.getProperty(changes, "system.weaponStyle") ??
                item.system?.weaponStyle ??
                "",
        );
        defaultSkill = DEFAULT_ATTACHED_SKILL.weapon[style] ?? "";
    } else if (item.type === "equipment") {
        defaultSkill = DEFAULT_ATTACHED_SKILL.equipment;
    }

    if (defaultSkill) {
        foundry.utils.setProperty(changes, "system.rollable.attachedSkill", defaultSkill);
    }
});
