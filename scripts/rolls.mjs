/* global foundry, game, ChatMessage, Roll */

import {
  ALL_SKILL_KEYS,
  ATTR_VALUE_MAX,
  DEFAULT_CHARACTER_ATTRIBUTES,
  SKILL_VALUE_MAX,
  customRollKey,
  defaultSkillTotals,
  extendedSkillRollKey
} from "./config.mjs";

export function buildRollData(actor) {
  if (!actor || actor.type !== "character") return {};
  const s = actor.system;
  const attrs = foundry.utils.mergeObject(
    foundry.utils.duplicate(DEFAULT_CHARACTER_ATTRIBUTES),
    s.attributes ?? {}
  );
  const skills = foundry.utils.mergeObject(defaultSkillTotals(), s.skills ?? {});
  const clampedSkills = {};
  for (const k of ALL_SKILL_KEYS) {
    clampedSkills[k] = Math.max(0, Math.min(SKILL_VALUE_MAX, Number(skills[k]) || 0));
  }
  const data = {
    body: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.body) || 0)),
    adroit: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.adroit) || 0)),
    mind: Math.max(0, Math.min(ATTR_VALUE_MAX, Number(attrs.mind) || 0)),
    ...clampedSkills
  };
  for (const row of s.customSkills ?? []) {
    if (row?.id)
      data[customRollKey(row.id)] =
        Math.max(0, Math.min(SKILL_VALUE_MAX, Number(row.value) || 0));
  }
  return data;
}

export async function rollSkill(actor, attrKey, skillKey, options = {}) {
  if (!actor) return;
  const data = buildRollData(actor);
  const formula = skillKey ? `1d20 + @${attrKey} + @${extendedSkillRollKey(skillKey)}` : `1d20 + @${attrKey}`;
  const roll = new Roll(formula, data);
  await roll.evaluate();
  const attrLabel = game.i18n.localize(`FARKPG.Attributes.${attrKey}.label`);
  let skillDisplay = "";
  if (skillKey) {
    if (ALL_SKILL_KEYS.has(skillKey)) {
      skillDisplay = game.i18n.localize(`FARKPG.Skills.${skillKey}.label`);
    } else {
      skillDisplay =
        actor.system.customSkills?.find((c) => c.id === skillKey)?.label?.trim() ||
        game.i18n.localize("FARKPG.CustomSkill");
    }
  }
  const flavor =
    options.label ?? (skillKey ? `${attrLabel} + ${skillDisplay}` : attrLabel);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}
