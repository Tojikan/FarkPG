import { SYSTEM_ID } from "./config.mjs";
import { FarkPGCharacterSheet } from "./sheets/character-sheet.mjs";
import { FarkPGItemSheet } from "./sheets/item-sheet.mjs";

Hooks.once("init", async () => {
    CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
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

    await foundry.applications.handlebars.loadTemplates([
        `systems/${SYSTEM_ID}/templates/actor/parts/header.hbs`,
        `systems/${SYSTEM_ID}/templates/actor/parts/tabs.hbs`,
        `systems/${SYSTEM_ID}/templates/actor/parts/tab-character.hbs`,
        `systems/${SYSTEM_ID}/templates/actor/parts/tab-inventory.hbs`,
        `systems/${SYSTEM_ID}/templates/actor/parts/tab-config.hbs`,
    ]);
});
