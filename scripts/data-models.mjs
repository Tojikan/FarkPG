/* global foundry, CONFIG */

import { ALL_SKILL_KEYS, ATTR_VALUE_MAX, SKILL_VALUE_MAX } from "./config.mjs";

export function registerDataModels() {
  const { TypeDataModel } = foundry.abstract;
  const fields = foundry.data.fields;

  const durabilitySchema = () =>
    new fields.SchemaField({
      value: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      max: new fields.NumberField({ integer: true, initial: 0, min: 0 })
    });

  const rollableSchema = () =>
    new fields.SchemaField({
      multiplier: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
      max: new fields.NumberField({ integer: true, initial: 0, min: 0 })
    });

  class FarkpgCharacterData extends TypeDataModel {
    static defineSchema() {
      return {
        biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        attributes: new fields.SchemaField({
          body: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, max: ATTR_VALUE_MAX }),
          adroit: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, max: ATTR_VALUE_MAX }),
          mind: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, max: ATTR_VALUE_MAX })
        }),
        skills: new fields.SchemaField({
          meleeWeapons: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          block: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          unarmed: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          endurance: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          athletics: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          rangedWeapons: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          dodge: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          perception: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          throwing: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          coordination: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          stealth: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          charisma: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          intelligence: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          sanity: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          instinct: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX }),
          luck: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX })
        }),
        resources: new fields.SchemaField({
          health: new fields.SchemaField({
            value: new fields.NumberField({ integer: true, initial: 12, min: 0 }),
            max: new fields.NumberField({ integer: true, initial: 12, min: 0 })
          }),
          actionPoints: new fields.SchemaField({
            value: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
            max: new fields.NumberField({ integer: true, initial: 4, min: 0 })
          }),
          exp: new fields.SchemaField({
            value: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
            max: new fields.NumberField({ integer: true, initial: 100, min: 0 })
          }),
          movement: new fields.NumberField({ integer: true, initial: 30, min: 0 })
        }),
        inventory: new fields.SchemaField({
          maxSlots: new fields.NumberField({ integer: true, initial: 4, min: 1 }),
          layout: new fields.StringField({ initial: "grid" })
        }),
        equipment: new fields.SchemaField({
          slotCount: new fields.NumberField({ integer: true, initial: 2, min: 1 })
        }),
        customSkills: new fields.ArrayField(
          new fields.SchemaField({
            id: new fields.StringField({ required: true, blank: false }),
            attrKey: new fields.StringField({ required: true, blank: false, initial: "body" }),
            label: new fields.StringField({ required: true, blank: true, initial: "Skill" }),
            value: new fields.NumberField({ integer: true, initial: 0, min: 0, max: SKILL_VALUE_MAX })
          })
        )
      };
    }

    static migrateData(source) {
      if (source.biography == null) source.biography = "";
      if (!Array.isArray(source.customSkills)) source.customSkills = [];
      if (Array.isArray(source.customAttributes) && source.customAttributes.length) {
        for (const r of source.customAttributes) {
          source.customSkills.push({
            id: r?.id ?? foundry.utils.randomID(),
            attrKey: "body",
            label: typeof r?.label === "string" ? r.label : "Skill",
            value: Math.max(0, Math.min(SKILL_VALUE_MAX, Number(r?.value) || 0))
          });
        }
        delete source.customAttributes;
      }
      if (!source.equipment || typeof source.equipment !== "object") source.equipment = {};
      if (
        typeof source.equipment.slotCount !== "number" ||
        Number.isNaN(source.equipment.slotCount) ||
        source.equipment.slotCount < 1
      ) {
        source.equipment.slotCount = Math.max(1, Number(source.equipment.slotCount) || 2);
      }
      const r = source.resources;
      if (r) {
        if (typeof r.exp === "number") {
          const v = r.exp;
          r.exp = { value: v, max: Math.max(v, 100) };
        }
        if (r.movement != null && typeof r.movement === "object") {
          r.movement = r.movement.value ?? 30;
        }
      }
      if (Array.isArray(source.customSkills)) {
        for (const row of source.customSkills) {
          if (!row || typeof row !== "object") continue;
          row.value = Math.max(0, Math.min(SKILL_VALUE_MAX, Number(row.value) || 0));
        }
      }
      const attrs = source.attributes;
      if (attrs && typeof attrs === "object") {
        for (const k of ["body", "adroit", "mind"]) {
          let v = Number(attrs[k]);
          if (!Number.isFinite(v)) v = 1;
          attrs[k] = Math.max(0, Math.min(ATTR_VALUE_MAX, Math.trunc(v)));
        }
      }
      const sk = source.skills;
      if (sk && typeof sk === "object") {
        for (const k of ALL_SKILL_KEYS) {
          let v = Number(sk[k]);
          if (!Number.isFinite(v)) v = 0;
          sk[k] = Math.max(0, Math.min(SKILL_VALUE_MAX, Math.trunc(v)));
        }
      }
      return source;
    }
  }

  class FarkpgWeaponData extends TypeDataModel {
    static migrateData(source) {
      if (typeof source?.isEquipped !== "boolean") source.isEquipped = false;
      return source;
    }

    static defineSchema() {
      return {
        description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        durability: durabilitySchema(),
        rollable: rollableSchema(),
        weaponStyle: new fields.StringField({ initial: "melee" }),
        ammo: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          perUse: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
          linkedConsumableId: new fields.StringField({ initial: "" })
        }),
        isEquipped: new fields.BooleanField({ initial: false })
      };
    }
  }

  class FarkpgConsumableData extends TypeDataModel {
    static migrateData(source) {
      if (typeof source?.isEquipped !== "boolean") source.isEquipped = false;
      return source;
    }

    static defineSchema() {
      return {
        description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        durability: durabilitySchema(),
        rollable: rollableSchema(),
        quantity: new fields.SchemaField({
          value: new fields.NumberField({ integer: true, initial: 1, min: 0 }),
          max: new fields.NumberField({ integer: true, initial: 99, min: 0 })
        }),
        isEquipped: new fields.BooleanField({ initial: false })
      };
    }
  }

  class FarkpgEquipmentData extends TypeDataModel {
    static migrateData(source) {
      if (typeof source?.isEquipped !== "boolean") source.isEquipped = false;
      return source;
    }

    static defineSchema() {
      return {
        description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        durability: durabilitySchema(),
        rollable: rollableSchema(),
        isEquipped: new fields.BooleanField({ initial: false })
      };
    }
  }

  class FarkpgAbilityData extends TypeDataModel {
    static defineSchema() {
      return {
        description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        cost: new fields.NumberField({ integer: true, initial: 0, min: 0 }),
        rank: new fields.NumberField({ integer: true, initial: 1, min: 1 }),
        maxRank: new fields.NumberField({ integer: true, initial: 1, min: 1 })
      };
    }
  }

  CONFIG.Actor.dataModels.character = FarkpgCharacterData;
  CONFIG.Item.dataModels.weapon = FarkpgWeaponData;
  CONFIG.Item.dataModels.consumable = FarkpgConsumableData;
  CONFIG.Item.dataModels.equipment = FarkpgEquipmentData;
  CONFIG.Item.dataModels.ability = FarkpgAbilityData;
}
