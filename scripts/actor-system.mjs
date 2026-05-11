/* global foundry */

import {
  ATTR_VALUE_MAX,
  ALL_SKILL_KEYS,
  DEFAULT_CHARACTER_ATTRIBUTES,
  SKILL_VALUE_MAX,
  defaultSkillTotals
} from "./config.mjs";

/** Ensure attributes/skills exist (sheet getData duplicate can omit nested keys). */
export function normalizeSheetSystem(sys) {
  sys.attributes = foundry.utils.mergeObject(
    foundry.utils.duplicate(DEFAULT_CHARACTER_ATTRIBUTES),
    sys.attributes ?? {}
  );
  sys.skills = foundry.utils.mergeObject(defaultSkillTotals(), sys.skills ?? {});
  sys.equipment = foundry.utils.mergeObject({ slotCount: 2 }, sys.equipment ?? {});
  let slots = Number(sys.equipment.slotCount);
  if (!Number.isFinite(slots) || slots < 1) slots = 2;
  sys.equipment.slotCount = Math.floor(slots);
  for (const k of ["body", "adroit", "mind"]) {
    let v = Number(sys.attributes[k]);
    if (!Number.isFinite(v)) v = DEFAULT_CHARACTER_ATTRIBUTES[k] ?? 0;
    sys.attributes[k] = Math.max(0, Math.min(ATTR_VALUE_MAX, Math.trunc(v)));
  }
  for (const k of ALL_SKILL_KEYS) {
    let v = Number(sys.skills[k]);
    if (!Number.isFinite(v)) v = 0;
    sys.skills[k] = Math.max(0, Math.min(SKILL_VALUE_MAX, Math.trunc(v)));
  }
  if (Array.isArray(sys.customSkills)) {
    sys.customSkills = sys.customSkills.map((row) => ({
      ...(row ?? {}),
      value: Math.max(0, Math.min(SKILL_VALUE_MAX, Number(row?.value) || 0))
    }));
  }
  return sys;
}
