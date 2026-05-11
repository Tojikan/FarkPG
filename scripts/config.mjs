/* global foundry */

export const BODY_SKILLS = ["meleeWeapons", "block", "unarmed", "endurance", "athletics"];
export const ADROIT_SKILLS = ["rangedWeapons", "dodge", "perception", "throwing", "coordination", "stealth"];
export const MIND_SKILLS = ["charisma", "intelligence", "sanity", "instinct", "luck"];
export const ALL_SKILL_KEYS = new Set([...BODY_SKILLS, ...ADROIT_SKILLS, ...MIND_SKILLS]);
export const ATTR_VALUE_MAX = 6;
export const SKILL_VALUE_MAX = 4;

export const DEFAULT_CHARACTER_ATTRIBUTES = { body: 1, adroit: 1, mind: 1 };

export function customRollKey(id) {
  return `cust_${String(id).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function defaultSkillTotals() {
  const o = {};
  for (const k of [...BODY_SKILLS, ...ADROIT_SKILLS, ...MIND_SKILLS]) o[k] = 0;
  return o;
}

export function extendedSkillRollKey(skillIdOrKey) {
  const s = String(skillIdOrKey);
  if (ALL_SKILL_KEYS.has(s)) return s;
  return customRollKey(skillIdOrKey);
}
