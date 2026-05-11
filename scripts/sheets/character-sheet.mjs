/* global foundry, game, ui, Item, Actors */

import { normalizeSheetSystem } from "../actor-system.mjs";
import {
  abilityItems,
  equippedGearCount,
  equippedPanel,
  gearIsEquipped,
  inventoryCount,
  inventoryRowModel,
  skillGroupsFromSystem,
  stripEquipped
} from "../inventory.mjs";
import { rollSkill } from "../rolls.mjs";
import { textEditorUx } from "../text-editor-ux.mjs";

export function registerFarkpgCharacterSheet() {
  const { HandlebarsApplicationMixin } = foundry.applications.api;
  const { ActorSheetV2 } = foundry.applications.sheets;

  class FarkpgCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(ActorSheetV2.DEFAULT_OPTIONS),
      {
        classes: ["farkpg", "sheet", "actor", "character"],
        position: { width: 920, height: 820 },
        window: {
          resizable: true,
          minimizable: true
        },
        form: {
          submitOnChange: true,
          closeOnSubmit: false
        }
      },
      { inplace: false }
    );

    /** @inheritdoc */
    static PARTS = {
      sheet: {
        template: "systems/farkpg-znz/templates/actor-character.hbs"
      }
    };

    constructor(options = {}) {
      super(options);
      /** @private */
      this._abortSheetUi = null;
    }

    async _tearDown(...args) {
      this._abortSheetUi?.abort();
      this._abortSheetUi = null;
      await super._tearDown(...args);
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const actor = this.actor;
      const sys = foundry.utils.duplicate(context.system ?? {});

      let bioStr = "";
      if (typeof sys.biography === "string") bioStr = sys.biography;
      else if (typeof actor.system?.biography === "string") bioStr = actor.system.biography;
      else if (typeof actor.system?.toObject === "function") {
        try {
          const plain = actor.system.toObject(false);
          if (typeof plain?.biography === "string") bioStr = plain.biography;
        } catch {
          bioStr = "";
        }
      }
      sys.biography = bioStr;

      sys.resources = foundry.utils.duplicate(sys.resources ?? {});
      sys.resources.health = foundry.utils.mergeObject(
        { value: 0, max: 0 },
        typeof sys.resources.health === "object" && sys.resources.health ? sys.resources.health : {}
      );
      sys.resources.actionPoints = foundry.utils.mergeObject(
        { value: 0, max: 0 },
        typeof sys.resources.actionPoints === "object" && sys.resources.actionPoints ? sys.resources.actionPoints : {}
      );
      const expRaw = sys.resources.exp;
      if (typeof expRaw === "number") {
        sys.resources.exp = { value: expRaw, max: Math.max(expRaw, 100) };
      } else if (typeof expRaw !== "object" || expRaw == null) {
        sys.resources.exp = { value: 0, max: 100 };
      } else {
        sys.resources.exp = {
          value: Number(expRaw.value ?? 0),
          max: Number(expRaw.max ?? 100)
        };
      }
      const mov = sys.resources.movement;
      if (typeof mov === "number" && !Number.isNaN(mov)) {
        sys.resources.movement = mov;
      } else if (mov && typeof mov === "object") {
        sys.resources.movement = Number(mov.value ?? 30);
      } else {
        sys.resources.movement = 30;
      }

      sys.inventory = foundry.utils.mergeObject({ maxSlots: 4, layout: "grid" }, sys.inventory ?? {});

      if (!Array.isArray(sys.customSkills)) sys.customSkills = [];
      else {
        sys.customSkills = sys.customSkills.map((row) => {
          let attrKey = row?.attrKey;
          if (!["body", "adroit", "mind"].includes(attrKey)) attrKey = "body";
          return {
            id: row?.id ?? foundry.utils.randomID(),
            attrKey,
            label: typeof row.label === "string" ? row.label : "Skill",
            value: Number(row.value) || 0
          };
        });
      }

      normalizeSheetSystem(sys);

      context.system = sys;
      context.skillGroups = skillGroupsFromSystem(sys);
      context.equippedPanelItems = equippedPanel(actor, sys);
      context.equipmentEquippedUsed = equippedGearCount(actor);
      context.inventoryRows = inventoryRowModel(actor, sys);
      context.abilityItems = abilityItems(actor).map((i) => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: foundry.utils.duplicate(i.system)
      }));
      context.inventoryCount = inventoryCount(actor);
      const bioHtml = bioStr.trim()
        ? await textEditorUx().enrichHTML(bioStr, {
            secrets: actor.isOwner,
            relativeTo: actor,
            async: true
          })
        : "";
      context.enrichedBiography = bioHtml ?? "";
      context.document = actor;
      context.actor = actor;
      context.cssClass ??= [...(this.constructor.DEFAULT_OPTIONS.classes ?? [])].join(" ");

      context.editable = typeof context.editable === "boolean" ? context.editable : this.isEditable;
      return context;
    }

    async _onRender(context, options) {
      if (
        Array.isArray(options?.parts) &&
        options.parts.length > 0 &&
        options.parts.every((p) => p !== "sheet")
      ) {
        return super._onRender(context, options);
      }
      this._abortSheetUi?.abort();
      this._abortSheetUi = new AbortController();
      const { signal } = this._abortSheetUi;

      await super._onRender(context, options);

      const form = this.element?.querySelector("form") ?? this.form;
      if (!form || !this.isEditable) return;

      for (const el of form.querySelectorAll(".farkpg-tabs .item[data-tab]")) {
        el.addEventListener(
          "click",
          (ev) => {
            ev.preventDefault();
            const tab = ev.currentTarget.dataset.tab;
            this._savedSheetTab = tab;
            for (const t of form.querySelectorAll(".farkpg-tabs .item")) {
              t.classList.toggle("active", t.dataset.tab === tab);
            }
            for (const p of form.querySelectorAll(".farkpg-tab-panel")) {
              const show = p.dataset.tabPanel === tab;
              p.classList.toggle("active", show);
              p.classList.toggle("hidden", !show);
            }
          },
          { signal }
        );
      }

      let tabRestore = this._savedSheetTab ?? "character";
      if (tabRestore === "main") tabRestore = "character";
      const validTabs = new Set(["character", "inventory", "config"]);
      if (!validTabs.has(tabRestore)) tabRestore = "character";
      if (tabRestore !== "character") {
        form.querySelectorAll(".farkpg-tabs .item").forEach((t) =>
          t.classList.toggle("active", t.dataset.tab === tabRestore)
        );
        form.querySelectorAll(".farkpg-tab-panel").forEach((p) => {
          const show = p.dataset.tabPanel === tabRestore;
          p.classList.toggle("active", show);
          p.classList.toggle("hidden", !show);
        });
      }

      form.querySelectorAll(".rollable.attr-roll").forEach((el) =>
        el.addEventListener("click", (ev) => this._onRollAttr(ev), { signal })
      );
      form.querySelectorAll(".rollable.skill-roll").forEach((el) =>
        el.addEventListener("click", (ev) => this._onRollSkill(ev), { signal })
      );

      form.querySelectorAll(".add-custom-skill").forEach((el) =>
        el.addEventListener("click", (ev) => this._onAddCustomSkill(ev), { signal })
      );
      form.querySelectorAll(".remove-custom-skill").forEach((el) =>
        el.addEventListener("click", (ev) => this._onRemoveCustomSkill(ev), { signal })
      );
      form.querySelectorAll(".create-item").forEach((el) =>
        el.addEventListener("click", (ev) => this._onCreateItem(ev), { signal })
      );

      form.querySelectorAll(".farkpg-ability-row .item-edit").forEach((el) =>
        el.addEventListener("click", (ev) => this._onAbilityEdit(ev), { signal })
      );
      form.querySelectorAll(".farkpg-ability-row .item-delete").forEach((el) =>
        el.addEventListener("click", (ev) => this._onAbilityDelete(ev), { signal })
      );

      form.querySelectorAll(".farkpg-equipped-row .item-edit").forEach((el) =>
        el.addEventListener("click", (ev) => this._onEquippedEdit(ev), { signal })
      );
      form.querySelectorAll(".farkpg-equipped-row .item-delete").forEach((el) =>
        el.addEventListener("click", (ev) => this._onEquippedDelete(ev), { signal })
      );
      form.querySelectorAll(".farkpg-unequip").forEach((el) =>
        el.addEventListener("click", (ev) => this._onUnequipEquipped(ev), { signal })
      );

      form.querySelector(".farkpg-item-table tbody")?.addEventListener(
        "click",
        (ev) => {
          const t = ev.target.closest(".farkpg-equip-from-stash");
          if (!t?.closest("tbody")) return;
          ev.preventDefault();
          ev.stopPropagation();
          void this._onToggleEquipTable(ev);
        },
        { signal }
      );

      form.querySelectorAll(".edit-item-sheet").forEach((el) =>
        el.addEventListener("click", (ev) => this._onInventoryEditTable(ev), { signal })
      );
      form.querySelectorAll(".delete-item-sheet").forEach((el) =>
        el.addEventListener("click", (ev) => this._onInventoryDeleteTable(ev), { signal })
      );
    }

    _itemFromTarget(ev) {
      const row = ev.currentTarget?.closest?.("[data-item-id]") ?? ev.target?.closest?.("[data-item-id]");
      const id = row?.dataset.itemId;
      return id ? this.actor.items.get(id) : null;
    }

    async _onRollAttr(ev) {
      ev.preventDefault();
      const attr = ev.currentTarget.dataset.attr;
      await rollSkill(this.actor, attr, "");
    }

    async _onRollSkill(ev) {
      ev.preventDefault();
      const el = ev.currentTarget;
      const skill = el.dataset.skill;
      if (!skill) return;
      await rollSkill(this.actor, el.dataset.attr, skill);
    }

    async _onAddCustomSkill(ev) {
      ev.preventDefault();
      const ak = ev.currentTarget.dataset.attrKey;
      if (!["body", "adroit", "mind"].includes(ak)) return;
      const cur = [...(this.actor.system.customSkills ?? [])];
      cur.push({
        id: foundry.utils.randomID(),
        attrKey: ak,
        label: game.i18n.localize("FARKPG.CustomSkill"),
        value: 0
      });
      await this.actor.update({ "system.customSkills": cur });
    }

    async _onRemoveCustomSkill(ev) {
      ev.preventDefault();
      const idx = Number(ev.currentTarget.dataset.index);
      if (Number.isNaN(idx)) return;
      const cur = [...(this.actor.system.customSkills ?? [])];
      cur.splice(idx, 1);
      await this.actor.update({ "system.customSkills": cur });
    }

    async _onCreateItem(ev) {
      ev.preventDefault();
      const type = ev.currentTarget.dataset.type;
      const fromInventory = !!ev.currentTarget.closest(".farkpg-inv-toolbar, [data-tab-panel='inventory']");
      if (fromInventory) this._savedSheetTab = "inventory";
      else if (type === "ability") this._savedSheetTab = "character";

      const max = this.actor.system.inventory?.maxSlots ?? 4;
      if (inventoryCount(this.actor) >= max && type !== "ability") {
        ui.notifications.warn(`Inventory full (${max} slots).`);
        return;
      }
      const itemData = { name: game.i18n.localize(`TYPES.Item.${type}`), type };
      await Item.create(itemData, { parent: this.actor });
    }

    _onAbilityEdit(ev) {
      ev.stopPropagation();
      this._savedSheetTab = "character";
      const item = this._itemFromTarget(ev);
      item?.sheet?.render(true);
    }

    async _onAbilityDelete(ev) {
      ev.stopPropagation();
      const item = this._itemFromTarget(ev);
      if (!item) return;
      await item.deleteDialog();
    }

    _onEquippedEdit(ev) {
      ev.stopPropagation();
      this._savedSheetTab = "character";
      const item = this._itemFromTarget(ev);
      item?.sheet?.render(true);
    }

    async _onEquippedDelete(ev) {
      ev.stopPropagation();
      const item = this._itemFromTarget(ev);
      if (!item) return;
      await item.deleteDialog();
    }

    async _onUnequipEquipped(ev) {
      ev.preventDefault();
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      if (!id) return;
      this._savedSheetTab = "character";
      await stripEquipped(this.actor, id);
    }

    async _onToggleEquipTable(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const tr = ev.currentTarget.closest("tr[data-item-id]");
      const id = tr?.dataset.itemId;
      if (!id) return;
      const actor = this.actor;
      const item = actor.items.get(id);
      if (!item || !["weapon", "consumable", "equipment"].includes(item.type)) return;
      if (gearIsEquipped(item)) return;
      const sys = foundry.utils.duplicate(actor.system);
      normalizeSheetSystem(sys);
      const max = Math.max(1, Number(sys.equipment?.slotCount) || 2);
      if (equippedGearCount(actor) >= max) {
        ui.notifications.warn(game.i18n.localize("FARKPG.EquipSlotsFull"));
        return;
      }
      this._savedSheetTab = "character";
      await item.update({ "system.isEquipped": true });
    }

    _onInventoryEditTable(ev) {
      ev.preventDefault();
      this._savedSheetTab = "inventory";
      const item = this._itemFromTarget(ev);
      item?.sheet?.render(true);
    }

    async _onInventoryDeleteTable(ev) {
      ev.preventDefault();
      const item = this._itemFromTarget(ev);
      if (!item) return;
      this._savedSheetTab = "inventory";
      await item.deleteDialog();
    }
  }

  Actors.registerSheet("farkpg-znz", FarkpgCharacterSheet, { types: ["character"], makeDefault: true });
}
