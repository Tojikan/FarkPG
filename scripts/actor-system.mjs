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
/** Coerce form-submitted blanks / strings so TypeDataModel number fields don't reject partial updates. Skips nested objects so merge artifacts don't become NaN → 0. */
export function sanitizeCharacterSystemPatch(patch) {
  if (!patch || typeof patch !== "object") return;
  const nzInt = (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const num = Number(v);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
  };
  const slotMinPrimitive = (v, fallback = 2) => {
    if (typeof v === "object" && v !== null) return fallback;
    return Math.max(1, nzInt(v) || fallback);
  };

  /** @returns {number|undefined} coerced integer, or undefined if value should not be patched (omit non-primitives from delta) */
  const coercePrimitiveInt = (v, min, max) => {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return undefined;
    if (typeof v === "string" || typeof v === "number" || v === "" || v === null || v === undefined) {
      return Math.max(min, Math.min(max, nzInt(v)));
    }
    return undefined;
  };

  const RESOURCE_CEIL = 99999999;

  if (patch.attributes && typeof patch.attributes === "object") {
    const a = patch.attributes;
    for (const k of Object.keys(a)) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      const coerced = coercePrimitiveInt(a[k], 0, ATTR_VALUE_MAX);
      if (coerced !== undefined) a[k] = coerced;
      else delete a[k];
    }
  }

  if (patch.skills && typeof patch.skills === "object") {
    const s = patch.skills;
    for (const k of Object.keys(s)) {
      if (!Object.prototype.hasOwnProperty.call(s, k)) continue;
      const coerced = coercePrimitiveInt(s[k], 0, SKILL_VALUE_MAX);
      if (coerced !== undefined) s[k] = coerced;
      else delete s[k];
    }
  }

  const r = patch.resources;
  if (r?.health && typeof r.health === "object") {
    const h = r.health;
    for (const key of ["value", "max"]) {
      if (!(key in h)) continue;
      const coerced = coercePrimitiveInt(h[key], 0, RESOURCE_CEIL);
      if (coerced !== undefined) h[key] = coerced;
      else delete h[key];
    }
  }
  if (r?.actionPoints && typeof r.actionPoints === "object") {
    const ap = r.actionPoints;
    for (const key of ["value", "max"]) {
      if (!(key in ap)) continue;
      const coerced = coercePrimitiveInt(ap[key], 0, RESOURCE_CEIL);
      if (coerced !== undefined) ap[key] = coerced;
      else delete ap[key];
    }
  }
  if (r?.exp && typeof r.exp === "object") {
    const ex = r.exp;
    if ("value" in ex) {
      const c = coercePrimitiveInt(ex.value, 0, RESOURCE_CEIL);
      if (c !== undefined) ex.value = c;
      else delete ex.value;
    }
    if ("max" in ex) {
      const c = coercePrimitiveInt(ex.max, 1, RESOURCE_CEIL);
      if (c !== undefined) ex.max = Math.max(1, c);
      else delete ex.max;
    }
  }
  if (patch.resources && Object.prototype.hasOwnProperty.call(patch.resources, "movement")) {
    const m = patch.resources.movement;
    const coerced = coercePrimitiveInt(m, 0, RESOURCE_CEIL);
    if (coerced !== undefined) patch.resources.movement = coerced;
    else delete patch.resources.movement;
  }

  if (patch.equipment && typeof patch.equipment === "object") {
    if ("equippedIds" in patch.equipment) delete patch.equipment.equippedIds;
    if ("slotCount" in patch.equipment) {
      patch.equipment.slotCount = slotMinPrimitive(patch.equipment.slotCount, 2);
    }
  }

  if (patch.inventory && typeof patch.inventory === "object" && "maxSlots" in patch.inventory) {
    patch.inventory.maxSlots = slotMinPrimitive(patch.inventory.maxSlots, 4);
  }

  if (Array.isArray(patch.customSkills)) {
    for (const row of patch.customSkills) {
      if (!row || typeof row !== "object" || !Object.prototype.hasOwnProperty.call(row, "value")) continue;
      const coerced = coercePrimitiveInt(row.value, 0, SKILL_VALUE_MAX);
      if (coerced !== undefined) row.value = coerced;
      else delete row.value;
    }
  }
}

