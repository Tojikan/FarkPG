import { SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * Generic item sheet — one template covers all four item types. Only the body of
 * the form changes based on `item.type`, the rest is shared.
 */
export class FarkPGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["farkpg", "sheet", "item"],
        position: { width: 480, height: 480 },
        window: { resizable: true, icon: "fa-solid fa-box" },
        form: { submitOnChange: true, closeOnSubmit: false },
    };

    /** @inheritDoc */
    static PARTS = {
        body: {
            template: `systems/${SYSTEM_ID}/templates/item/item.hbs`,
            scrollable: [""],
        },
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.system = this.item.system ?? {};
        context.item = this.item;
        context.editable = this.isEditable;
        context.isWeapon = this.item.type === "weapon";
        context.isConsumable = this.item.type === "consumable";
        context.isEquipment = this.item.type === "equipment";
        context.isAbility = this.item.type === "ability";
        context.canEquip = !context.isAbility;

        context.descriptionHTML = await TextEditor.implementation.enrichHTML(
            this.item.system?.description ?? "",
            {
                secrets: this.item.isOwner,
                relativeTo: this.item,
                rollData: this.item.getRollData?.() ?? {},
            },
        );
        return context;
    }
}
