/* global foundry, game, Hooks */

/**
 * Entry point — wires Foundry hooks. Logic lives under ./scripts/ (see imports).
 */
import { rollSkill } from "./rolls.mjs";
import { registerFarkpgCharacterSheet } from "./sheets/character-sheet.mjs";
import { registerFarkpgItemSheets } from "./sheets/item-sheets.mjs";
import { useWeapon, useWeaponById } from "./weapons.mjs";

Hooks.once("init", () => {
  registerFarkpgCharacterSheet();
  registerFarkpgItemSheets();
});

Hooks.once("ready", () => {
  game.farkpg = {
    rollSkill,
    useWeapon,
    useWeaponById
  };
});
