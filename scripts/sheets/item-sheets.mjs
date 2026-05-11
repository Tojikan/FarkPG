/* global foundry, Items */

import { textEditorUx } from "../text-editor-ux.mjs";
import { useWeapon } from "../weapons.mjs";

export function registerFarkpgItemSheets() {
  const { HandlebarsApplicationMixin } = foundry.applications.api;
  const { ItemSheetV2 } = foundry.applications.sheets;

  class FarkpgItemCardSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(ItemSheetV2.DEFAULT_OPTIONS),
      {
        classes: ["farkpg", "sheet", "item", "item-card"],
        position: { width: 340, height: 560 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false }
      },
      { inplace: false }
    );

    static PARTS = {
      sheet: {
        template: "systems/farkpg-znz/templates/item-card.hbs",
        scrollable: [".card-desc"]
      }
    };

    constructor(options = {}) {
      super(options);
      /** @private */
      this._abortCardUi = null;
    }

    async _tearDown(...args) {
      this._abortCardUi?.abort();
      this._abortCardUi = null;
      await super._tearDown(...args);
    }

    /** @inheritdoc */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const item = this.item;
      const sys = item.system;

      const mult = sys.rollable?.multiplier ?? 0;
      const rmax = sys.rollable?.max ?? 0;
      context.showRollable = mult !== 0 && rmax !== 0;
      const dmax = sys.durability?.max ?? 0;
      context.showDurability = dmax > 0;
      context.isConsumable = item.type === "consumable";
      context.isWeapon = item.type === "weapon";
      context.meleeSelected = sys.weaponStyle === "melee" || !sys.weaponStyle;
      context.rangedSelected = sys.weaponStyle === "ranged";
      context.enrichedDescription = await textEditorUx().enrichHTML(sys.description ?? "", {
        secrets: item.isOwner,
        relativeTo: item,
        async: true
      });

      const actor = item.actor;
      context.consumableChoices = [];
      if (actor && item.type === "weapon") {
        context.consumableChoices = actor.items
          .filter((i) => i.type === "consumable")
          .map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.system.quantity?.value ?? 0,
            selected: i.id === (sys.ammo?.linkedConsumableId ?? "")
          }));
      }

      context.item = item;
      context.owner ??= item.isOwner;
      context.cssClass ??= [...(this.constructor.DEFAULT_OPTIONS.classes ?? [])].join(" ");
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
      this._abortCardUi?.abort();
      this._abortCardUi = new AbortController();
      const { signal } = this._abortCardUi;

      await super._onRender(context, options);

      const form = this.element?.querySelector("form") ?? this.form;
      if (!form || !this.isEditable) return;

      form.querySelector(".card-use-weapon")?.addEventListener(
        "click",
        (ev) => {
          void this._onUseWeapon(ev);
        },
        { signal }
      );
      form.querySelector('[data-edit="system.ammo.enabled"]')?.addEventListener(
        "change",
        (ev) => {
          void this.item.update({ "system.ammo.enabled": ev.currentTarget.checked });
        },
        { signal }
      );
    }

    async _onUseWeapon(ev) {
      ev.preventDefault();
      await useWeapon(this.item);
    }
  }

  class FarkpgAbilitySheet extends HandlebarsApplicationMixin(ItemSheetV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(ItemSheetV2.DEFAULT_OPTIONS),
      {
        classes: ["farkpg", "sheet", "item", "ability"],
        position: { width: 440, height: 420 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false }
      },
      { inplace: false }
    );

    static PARTS = {
      sheet: {
        template: "systems/farkpg-znz/templates/item-ability.hbs"
      }
    };

    /** @inheritdoc */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const item = this.item;
      const sys = item.system;
      context.enrichedDescription = await textEditorUx().enrichHTML(sys.description ?? "", {
        secrets: item.isOwner,
        relativeTo: item,
        async: true
      });
      context.item = item;
      context.owner ??= item.isOwner;
      context.cssClass ??= [...(this.constructor.DEFAULT_OPTIONS.classes ?? [])].join(" ");
      return context;
    }
  }

  Items.registerSheet("farkpg-znz", FarkpgItemCardSheet, {
    types: ["weapon", "consumable", "equipment"],
    makeDefault: true
  });
  Items.registerSheet("farkpg-znz", FarkpgAbilitySheet, { types: ["ability"], makeDefault: true });
}
