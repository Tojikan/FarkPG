import { ATTRIBUTE_KEYS, ATTRIBUTE_SKILLS, INVENTORY_ITEM_TYPES, SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * Character sheet. Uses the v13 native tab system: each tab is its own PART, and the
 * `tabs` part renders Foundry's generic tab navigation template.
 */
export class FarkPGCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["farkpg", "sheet", "actor", "character"],
        position: { width: 760, height: 720 },
        window: { resizable: true, icon: "fa-solid fa-user" },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
            rollSkill: FarkPGCharacterSheet.#onRollSkill,
            openDiceTable: FarkPGCharacterSheet.#onOpenDiceTable,
            addCustomSkill: FarkPGCharacterSheet.#onAddCustomSkill,
            removeCustomSkill: FarkPGCharacterSheet.#onRemoveCustomSkill,
            createItem: FarkPGCharacterSheet.#onCreateItem,
            editItem: FarkPGCharacterSheet.#onEditItem,
            deleteItem: FarkPGCharacterSheet.#onDeleteItem,
            toggleEquip: FarkPGCharacterSheet.#onToggleEquip,
            toggleBiographyEditor: FarkPGCharacterSheet.#onToggleBiographyEditor,
        },
    };

    /** @type {boolean} */
    _biographyEditing = false;

    /** @inheritDoc */
    static PARTS = {
        header: {
            template: `systems/${SYSTEM_ID}/templates/actor/parts/header.hbs`,
        },
        tabs: {
            template: `systems/${SYSTEM_ID}/templates/actor/parts/tabs.hbs`,
        },
        character: {
            template: `systems/${SYSTEM_ID}/templates/actor/parts/tab-character.hbs`,
            scrollable: [".farkpg-character-main"],
        },
        inventory: {
            template: `systems/${SYSTEM_ID}/templates/actor/parts/tab-inventory.hbs`,
            scrollable: [""],
        },
        config: {
            template: `systems/${SYSTEM_ID}/templates/actor/parts/tab-config.hbs`,
            scrollable: [""],
        },
    };

    /** @inheritDoc */
    static TABS = {
        primary: {
            tabs: [
                { id: "character", icon: "fa-solid fa-user" },
                { id: "inventory", icon: "fa-solid fa-briefcase" },
                { id: "config", icon: "fa-solid fa-gear" },
            ],
            labelPrefix: "FARKPG.Tabs",
            initial: "character",
        },
    };

    /* ----------------------------------------- */
    /*  Context                                  */
    /* ----------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.actor.system ?? {};

        context.system = system;
        context.actor = this.actor;
        context.editable = this.isEditable;
        context.biographyEditing = this._biographyEditing;
        context.tabs = this._prepareTabs("primary");

        const items = this.actor.items.contents;
        const isAbility = (i) => i.type === "ability";
        const isEquipped = (i) => !isAbility(i) && i.system?.isEquipped === true;
        const inInventory = (i) => !isAbility(i) && !isEquipped(i);

        context.equippedItems = items.filter(isEquipped).sort((a, b) => a.sort - b.sort);
        context.inventoryItems = items.filter(inInventory).sort((a, b) => a.sort - b.sort);
        context.abilities = items.filter(isAbility).sort((a, b) => a.sort - b.sort);

        context.slots = {
            equipment: {
                count: context.equippedItems.length,
                max: Number(system.config?.equipmentSlots ?? 0),
            },
            inventory: {
                count: context.inventoryItems.length,
                max: Number(system.config?.inventorySlots ?? 0),
            },
        };

        context.attributeBlocks = ATTRIBUTE_KEYS.map((key) => this.#buildAttributeBlock(key, system));
        context.inventoryItemTypes = INVENTORY_ITEM_TYPES;

        return context;
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (context.tabs && context.tabs[partId]) {
            context.tab = context.tabs[partId];
        }
        if (partId === "character") {
            context.biographyHTML = await TextEditor.implementation.enrichHTML(
                this.actor.system?.biography ?? "",
                {
                    secrets: this.actor.isOwner,
                    relativeTo: this.actor,
                    rollData: this.actor.getRollData?.() ?? {},
                },
            );
        }
        return context;
    }

    /**
     * @param {"body"|"adroit"|"mind"} key
     * @param {any} system
     */
    #buildAttributeBlock(key, system) {
        const attrValue = Number(system.attributes?.[key] ?? 0);
        const builtIn = (ATTRIBUTE_SKILLS[key] ?? []).map((skillKey) => ({
            kind: "builtin",
            key: skillKey,
            id: skillKey,
            label: game.i18n.localize(`FARKPG.Skills.${skillKey}`),
            value: Number(system.skills?.[skillKey] ?? 0),
            inputName: `system.skills.${skillKey}`,
        }));

        const customMap = system.customSkills ?? {};
        const custom = Object.values(customMap)
            .filter((s) => s && s.attribute === key)
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .map((s) => ({
                kind: "custom",
                key: s.id,
                id: s.id,
                label: s.name || game.i18n.localize("FARKPG.Skills.customDefault"),
                value: Number(s.value ?? 0),
                inputName: `system.customSkills.${s.id}.value`,
                nameInputName: `system.customSkills.${s.id}.name`,
            }));

        return {
            key,
            label: game.i18n.localize(`FARKPG.Attributes.${key}`),
            value: attrValue,
            inputName: `system.attributes.${key}`,
            skills: [...builtIn, ...custom],
        };
    }

    /* ----------------------------------------- */
    /*  Form submission                          */
    /* ----------------------------------------- */

    /** @inheritDoc */
    _prepareSubmitData(event, form, formData, updateData) {
        const data = super._prepareSubmitData(event, form, formData, updateData);
        const clamp = (n, min, max) => {
            const v = Number(n);
            if (!Number.isFinite(v)) return min;
            return Math.min(max, Math.max(min, v));
        };
        for (const key of ["body", "adroit", "mind"]) {
            const path = `system.attributes.${key}`;
            if (foundry.utils.hasProperty(data, path)) {
                foundry.utils.setProperty(data, path, clamp(foundry.utils.getProperty(data, path), 0, 6));
            }
        }
        const skills = foundry.utils.getProperty(data, "system.skills");
        if (skills && typeof skills === "object") {
            for (const k of Object.keys(skills)) {
                skills[k] = clamp(skills[k], 0, 4);
            }
        }
        const customSkills = foundry.utils.getProperty(data, "system.customSkills");
        if (customSkills && typeof customSkills === "object") {
            for (const entry of Object.values(customSkills)) {
                if (entry && typeof entry === "object" && "value" in entry) {
                    entry.value = clamp(entry.value, 0, 4);
                }
            }
        }
        return data;
    }

    /* ----------------------------------------- */
    /*  Render hooks                             */
    /* ----------------------------------------- */

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender?.(context, options);

        for (const input of this.element.querySelectorAll(".farkpg-custom-skill-name")) {
            input.addEventListener("change", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.currentTarget;
                const id = target.dataset.customId;
                const value = String(target.value ?? "").trim();
                if (!id) return;
                this.actor.update({ [`system.customSkills.${id}.name`]: value });
            });
        }
    }

    /* ----------------------------------------- */
    /*  Actions                                  */
    /* ----------------------------------------- */

    /**
     * Roll `1d20 + attribute + skill` to chat.
     * @this {FarkPGCharacterSheet}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static async #onRollSkill(event, target) {
        event.preventDefault();
        const attr = String(target.dataset.attribute ?? "");
        const skillKey = String(target.dataset.skill ?? "");
        const customId = String(target.dataset.customId ?? "");

        const system = this.actor.system ?? {};
        const atr = Number(system.attributes?.[attr] ?? 0);

        let skl = 0;
        let skillLabel = "";
        if (customId) {
            const entry = system.customSkills?.[customId];
            skl = Number(entry?.value ?? 0);
            skillLabel = String(entry?.name ?? "").trim() || game.i18n.localize("FARKPG.Skills.customDefault");
        } else if (skillKey) {
            skl = Number(system.skills?.[skillKey] ?? 0);
            skillLabel = game.i18n.localize(`FARKPG.Skills.${skillKey}`);
        }

        const attrLabel = game.i18n.localize(`FARKPG.Attributes.${attr}`);
        const flavor = skillLabel
            ? game.i18n.format("FARKPG.Rolls.skill", { skill: skillLabel, attribute: attrLabel })
            : game.i18n.format("FARKPG.Rolls.attribute", { attribute: attrLabel });

        const roll = new Roll("1d20 + @atr + @skl", { atr, skl });
        await roll.evaluate();
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor,
        });
    }

    /**
     * Open the Virtual Dice Table module window and auto-roll the dice pool for the
     * row that was clicked: `count = max(1, attribute + skill)` d6s.
     * @this {FarkPGCharacterSheet}
     */
    static async #onOpenDiceTable(event, target) {
        event?.preventDefault();

        const system = this.actor.system ?? {};
        const attr = String(target?.dataset?.attribute ?? "");
        const skillKey = String(target?.dataset?.skill ?? "");
        const customId = String(target?.dataset?.customId ?? "");

        const atr = attr ? Number(system.attributes?.[attr] ?? 0) : 0;
        let skl = 0;
        if (customId) skl = Number(system.customSkills?.[customId]?.value ?? 0);
        else if (skillKey) skl = Number(system.skills?.[skillKey] ?? 0);

        const count = Math.max(1, atr + skl);
        const faces = 6;

        const api = game.modules.get("virtual-dice-table")?.api;
        if (api?.openStartRollAndRoll) {
            try {
                await api.openStartRollAndRoll({ count, faces });
                return;
            } catch (err) {
                console.error("FarkPG | openStartRollAndRoll failed", err);
            }
        }
        if (api?.openVirtualTable) {
            api.openVirtualTable();
            return;
        }
        const direct = globalThis.virtualDiceTable;
        if (direct?.open) {
            direct.open();
            return;
        }
        ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.dicetableMissing"));
    }

    /**
     * Append a new custom skill scoped to the given attribute.
     * @this {FarkPGCharacterSheet}
     */
    static async #onAddCustomSkill(event, target) {
        event.preventDefault();
        const attribute = String(target.dataset.attribute ?? "");
        if (!ATTRIBUTE_KEYS.includes(/** @type {any} */ (attribute))) return;
        const id = foundry.utils.randomID();
        await this.actor.update({
            [`system.customSkills.${id}`]: {
                id,
                name: game.i18n.localize("FARKPG.Skills.customDefault"),
                attribute,
                value: 0,
            },
        });
    }

    /**
     * Remove a custom skill by ID using the deletion path syntax.
     * @this {FarkPGCharacterSheet}
     */
    static async #onRemoveCustomSkill(event, target) {
        event.preventDefault();
        const id = String(target.dataset.customId ?? "");
        if (!id) return;
        await this.actor.update({ [`system.customSkills.-=${id}`]: null });
    }

    /**
     * Create a new embedded item of the given type and open its sheet.
     * @this {FarkPGCharacterSheet}
     */
    static async #onCreateItem(event, target) {
        event.preventDefault();
        const type = String(target.dataset.itemType ?? "");
        if (!INVENTORY_ITEM_TYPES.includes(type)) return;
        const nameKey = `FARKPG.Items.new${type.charAt(0).toUpperCase()}${type.slice(1)}`;
        const [created] = await this.actor.createEmbeddedDocuments("Item", [
            { name: game.i18n.localize(nameKey), type },
        ]);
        created?.sheet?.render(true);
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static #onEditItem(event, target) {
        event.preventDefault();
        const id = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(id);
        item?.sheet?.render(true);
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static async #onDeleteItem(event, target) {
        event.preventDefault();
        const id = target.closest("[data-item-id]")?.dataset.itemId;
        if (!id) return;
        await this.actor.deleteEmbeddedDocuments("Item", [id]);
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static async #onToggleEquip(event, target) {
        event.preventDefault();
        const id = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(id);
        if (!item || item.type === "ability") return;
        await item.update({ "system.isEquipped": !item.system?.isEquipped });
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static #onToggleBiographyEditor(event) {
        event.preventDefault();
        this._biographyEditing = !this._biographyEditing;
        this.render(true);
    }
}
