/* global foundry, game, Hooks, CONFIG */

/**
 * Entry point — wires Foundry hooks. Logic lives under ./scripts/ (see imports).
 */
import { sanitizeCharacterSystemPatch } from "./actor-system.mjs";
import {
  ALL_SKILL_KEYS,
  ATTR_VALUE_MAX,
  SKILL_VALUE_MAX,
  customRollKey,
  DEFAULT_CHARACTER_ATTRIBUTES,
  defaultSkillTotals
} from "./config.mjs";
import { registerDataModels } from "./data-models.mjs";
import { buildRollData, rollSkill } from "./rolls.mjs";
import { registerFarkpgCharacterSheet } from "./sheets/character-sheet.mjs";
import { registerFarkpgItemSheets } from "./sheets/item-sheets.mjs";
import { useWeapon, useWeaponById } from "./weapons.mjs";

Hooks.once("init", () => {
  registerDataModels();
  registerFarkpgCharacterSheet();
  registerFarkpgItemSheets();
});

Hooks.once("setup", () => {
  Hooks.on("preUpdateActor", (document, delta) => {
    if (!delta?.system || document.type !== "character") return;
    sanitizeCharacterSystemPatch(delta.system);
  });

  const Doc = CONFIG.Actor.documentClass;
  const orig = Doc.prototype.getRollData;
  Doc.prototype.getRollData = function (...args) {
    const data = orig.apply(this, args);
    if (this.type === "character") {
      const attrs = foundry.utils.mergeObject(
        foundry.utils.duplicate(DEFAULT_CHARACTER_ATTRIBUTES),
        this.system?.attributes ?? {}
      );
      const skillsMerge = foundry.utils.mergeObject(defaultSkillTotals(), this.system?.skills ?? {});
      const clampedSkills = {};
      for (const k of ALL_SKILL_KEYS) {
        clampedSkills[k] = Math.max(0, Math.min(SKILL_VALUE_MAX, Number(skillsMerge[k]) || 0));
      }
      const extra = {
        body: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.body) || 0)),
        adroit: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.adroit) || 0)),
        mind: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.mind) || 0)),
        ...clampedSkills
      };
      for (const row of this.system?.customSkills ?? []) {
        if (row?.id)
          extra[customRollKey(row.id)] = Math.max(
            0,
            Math.min(SKILL_VALUE_MAX, Number(row.value) || 0)
          );
      }
      foundry.utils.mergeObject(data, extra);
    }
    return data;
  };
});

Hooks.once("ready", async () => {
  game.farkpg = {
    rollSkill,
    useWeapon,
    useWeaponById,
    buildRollData
  };
  console.log("FarkPG | game.farkpg.rollSkill, .useWeapon, .useWeaponById");
});
