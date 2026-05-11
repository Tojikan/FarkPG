import { SYSTEM_ID, ATTRIBUTE_SKILLS } from "../config.mjs";

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

        const style = String(this.item.system?.weaponStyle ?? "");
        context.isMeleeWeapon = context.isWeapon && style === "melee";
        context.ammoEnabled = context.isWeapon && this.item.system?.ammo?.enabled === true;

        const requiredAmmoNames = String(this.item.system?.ammo?.requiredNames ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        // Consumables on the parent actor (if any) usable as ammo. If Required
        // Ammo is set, only consumables whose names match the CSV are selectable.
        const actor = this.item.actor;
        context.actorConsumables = actor
            ? actor.items
                .filter((i) => i.type === "consumable" && i.id !== this.item.id)
                .filter((i) => {
                    if (!requiredAmmoNames.length) return true;
                    return requiredAmmoNames.includes(String(i.name).toLowerCase());
                })
                .map((i) => ({ id: i.id, name: i.name }))
                .sort((a, b) => a.name.localeCompare(b.name))
            : [];
        context.hasActor = !!actor;

        // (attribute, skill) pairs that can be attached to a weapon's roll.
        // When set, using the weapon rolls (attribute + skill) dice instead of
        // the static multiplier×max value.
        const attachedSkillOptions = [];
        for (const [attr, skills] of Object.entries(ATTRIBUTE_SKILLS)) {
            const aLabel = game.i18n.localize(`FARKPG.Attributes.${attr}`);
            for (const skill of skills) {
                const sLabel = game.i18n.localize(`FARKPG.Skills.${skill}`);
                attachedSkillOptions.push({
                    value: `${attr}.${skill}`,
                    label: `${aLabel} — ${sLabel}`,
                });
            }
        }
        context.attachedSkillOptions = attachedSkillOptions;

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
