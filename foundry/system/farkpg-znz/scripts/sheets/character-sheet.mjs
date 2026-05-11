import { FarkPGApDrawer, buildApTypeRowsForActor } from "../ap-drawer.mjs";
import { promptCharacterImport } from "../character-import.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_SKILLS, INVENTORY_ITEM_TYPES, SYSTEM_ID } from "../config.mjs";

/** Preview image when a custom AP type has no `img` path set. */
const CUSTOM_AP_IMG_FALLBACK = "icons/svg/aura.svg";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * Foundry 13+ FilePicker constructor (avoid deprecated global `FilePicker`).
 * @returns {any|null}
 */
function getFilePickerImplementation() {
    return foundry.applications.apps?.FilePicker?.implementation ?? null;
}

/**
 * Delete one keyed entry under `system` (e.g. `system.customSkills[id]` or
 * `system.resources.customActionPoints[id]`).
 *
 * Prefers `ForcedDeletion.create()` on the **leaf** path — passing the
 * `ForcedDeletion` class itself (instead of an operator instance) is ignored /
 * invalid and looks like “delete does nothing”.
 *
 * Falls back to `parent.-=id` with `performDeletions: true` when operators
 * are unavailable.
 *
 * Do not replace whole parent maps with `{ recursive: false }` on multi-segment
 * paths; that can wipe sibling `system` branches.
 *
 * @param {ClientDocument} doc
 * @param {string} parentPath Dot-path to the parent object (no trailing key).
 * @param {string} entryId
 * @returns {Promise<void>}
 */
async function deleteSystemKeyedEntry(doc, parentPath, entryId) {
    const FD = foundry.data?.operators?.ForcedDeletion;
    if (FD && typeof FD.create === "function") {
        await doc.update({ [`${parentPath}.${entryId}`]: FD.create() });
        return;
    }
    await doc.update({ [`${parentPath}.-=${entryId}`]: null }, { performDeletions: true });
}

/**
 * Open the image file picker and assign the chosen path to `actor.img`.
 * @param {Actor} actor
 * @param {boolean} editable
 */
function openActorPortraitPicker(actor, editable) {
    if (!editable || !actor?.canUserModify?.(game.user, "update")) return;
    const current = actor.img ?? "";
    const Picker = getFilePickerImplementation();
    if (!Picker) {
        ui.notifications?.error("FilePicker is not available in this Foundry build.");
        return;
    }
    const fp = new Picker({
        type: "image",
        current,
        callback: async (path) => {
            if (path && path !== current) await actor.update({ img: path });
        },
    });
    fp.render(true);
}

/**
 * Open Foundry's image file picker and pass the chosen path to `onPick`.
 * @param {string} current
 * @param {(path: string) => void} onPick
 */
function openImagePathPicker(current, onPick) {
    const Picker = getFilePickerImplementation();
    if (!Picker) {
        ui.notifications?.error("FilePicker is not available in this Foundry build.");
        return;
    }
    const fp = new Picker({
        type: "image",
        current: current ?? "",
        callback: (path) => {
            if (path) onPick(path);
        },
    });
    void Promise.resolve(fp.render(true)).then(() => {
        fp.bringToTop?.();
    });
}

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
            openApDrawer: FarkPGCharacterSheet.#onOpenApDrawer,
            addCustomSkill: FarkPGCharacterSheet.#onAddCustomSkill,
            removeCustomSkill: FarkPGCharacterSheet.#onRemoveCustomSkill,
            addCustomApType: FarkPGCharacterSheet.#onAddCustomApType,
            promptAddCustomAp: FarkPGCharacterSheet.#onPromptAddCustomAp,
            removeCustomApType: FarkPGCharacterSheet.#onRemoveCustomApType,
            createItem: FarkPGCharacterSheet.#onCreateItem,
            editItem: FarkPGCharacterSheet.#onEditItem,
            deleteItem: FarkPGCharacterSheet.#onDeleteItem,
            toggleEquip: FarkPGCharacterSheet.#onToggleEquip,
            useItem: FarkPGCharacterSheet.#onUseItem,
            selectAmmo: FarkPGCharacterSheet.#onSelectAmmo,
            toggleBiographyEditor: FarkPGCharacterSheet.#onToggleBiographyEditor,
            toggleSkillsEdit: FarkPGCharacterSheet.#onToggleSkillsEdit,
            editPortrait: FarkPGCharacterSheet.#onEditPortrait,
            openCharacterImport: FarkPGCharacterSheet.#onOpenCharacterImport,
        },
    };

    /** @type {boolean} */
    _biographyEditing = false;

    /**
     * Whether the Attributes & Skills sidebar is in edit mode. When false,
     * custom skills render exactly like base skills (no rename input, no
     * remove button) and the "Add custom skill" button is hidden.
     * @type {boolean}
     */
    _skillsEditing = false;

    /** @type {AbortController|null} */
    _renderListeners = null;

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
        context.canModifyActor = this.actor.canUserModify(game.user, "update");
        context.biographyEditing = this._biographyEditing;
        context.skillsEditing = this._skillsEditing;
        context.tabs = this._prepareTabs("primary");

        const items = this.actor.items.contents;
        const isAbility = (i) => i.type === "ability";
        const isEquipped = (i) => !isAbility(i) && i.system?.isEquipped === true;
        const inInventory = (i) => !isAbility(i) && !isEquipped(i);

        const decorate = (item) => {
            const sys = item.system ?? {};
            const mult = Number(sys.rollable?.multiplier ?? 0);
            const maxv = Number(sys.rollable?.max ?? 0);
            const isWeapon = item.type === "weapon";
            const isConsumable = item.type === "consumable";
            const isEquipment = item.type === "equipment";
            const hasDurability = isWeapon || isEquipment;
            const ammoEnabled = isWeapon && sys.ammo?.enabled === true;
            const linkedAmmo = ammoEnabled && sys.ammo?.linkedConsumableId
                ? this.actor.items.get(sys.ammo.linkedConsumableId)
                : null;

            // Resolve attached-skill rolling: when an attached skill is set,
            // the item rolls (attribute + skill) dice with `faces = rollMax`
            // (defaulting to d6 if no max is configured). Otherwise the static
            // (multiplier × max) baseline is used. Applies to every type that
            // exposes the `rollable.enabled` toggle on its sheet.
            const usesRollEnabled = isWeapon || isEquipment || isConsumable;
            const attachedSkill = usesRollEnabled
                ? String(sys.rollable?.attachedSkill ?? "")
                : "";
            let rollCount = mult;
            let rollFaces = maxv;
            let attachedSkillLabel = "";
            if (attachedSkill) {
                const [attrKey, skillKey] = attachedSkill.split(".");
                const aVal = Number(this.actor.system?.attributes?.[attrKey] ?? 0);
                const sVal = Number(this.actor.system?.skills?.[skillKey] ?? 0);
                rollCount = Math.max(1, aVal + sVal);
                rollFaces = maxv > 0 ? maxv : 6;
                const aLabel = game.i18n.localize(`FARKPG.Attributes.${attrKey}`);
                const sLabel = game.i18n.localize(`FARKPG.Skills.${skillKey}`);
                attachedSkillLabel = `${aLabel} — ${sLabel}`;
            }

            const rollEnabledFlag = sys.rollable?.enabled === true;
            // A roll *formula* exists when either an attached skill is set or
            // the multiplier × max baseline is filled in. When `rollable.enabled`
            // is true but nothing is configured, we still render a button --
            // it just opens the dice table without starting a roll.
            const hasRollFormula = attachedSkill !== "" || (mult > 0 && maxv > 0);
            const isRollable = usesRollEnabled ? rollEnabledFlag : hasRollFormula;
            const iconOnlyRoll = isRollable && !hasRollFormula;

            // Per-use consumption rendered as a small icon + signed amount
             // beneath the "Roll" label on the card. Order mirrors the order
             // costs are actually paid in `#onUseItem` so it doubles as a
             // legend.
            const consumptionBadges = [];
            if (isRollable && !iconOnlyRoll) {
                if (isWeapon && ammoEnabled && linkedAmmo) {
                    const perUse = Math.max(1, Number(sys.ammo?.perUse ?? 1));
                    consumptionBadges.push({
                        kind: "ammo",
                        icon: "fa-solid fa-crosshairs",
                        amount: perUse,
                        tooltip: game.i18n.format("FARKPG.Items.badgeAmmoTooltip", {
                            amount: perUse,
                        }),
                    });
                }
                if (isWeapon) {
                    const dpu = Number(sys.durabilityPerUse ?? 0);
                    if (dpu > 0) {
                        consumptionBadges.push({
                            kind: "durability",
                            icon: "fa-solid fa-screwdriver-wrench",
                            amount: dpu,
                            tooltip: game.i18n.format(
                                "FARKPG.Items.badgeDurabilityTooltip",
                                { amount: dpu },
                            ),
                        });
                    }
                }
                if (isConsumable) {
                    consumptionBadges.push({
                        kind: "quantity",
                        icon: "fa-solid fa-cubes-stacked",
                        amount: 1,
                        tooltip: game.i18n.localize("FARKPG.Items.badgeQuantityTooltip"),
                    });
                }
            }

            // Equipment can grant extra slots while equipped; surface those
             // values on the card so it's visible without opening the sheet.
            const equipmentSlotsBonus = isEquipment
                ? Number(sys.equipmentSlots ?? 0)
                : 0;
            const inventorySlotsBonus = isEquipment
                ? Number(sys.inventorySlots ?? 0)
                : 0;

            const rawDesc = String(sys.description ?? "");
            const descText = rawDesc
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const descShort = descText.length > 140 ? `${descText.slice(0, 137)}…` : descText;

            return {
                id: item.id,
                uuid: item.uuid,
                name: item.name,
                img: item.img,
                type: item.type,
                typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`),
                system: sys,
                isWeapon,
                isConsumable,
                isEquipment,
                hasDurability,
                descShort,
                isRollable,
                rollMultiplier: mult,
                rollMax: maxv,
                // Card splits the roll description across two labels:
                //   left  → dice formula being rolled (e.g. "5d")
                //   right → static multiplier × max cap (e.g. "4×6000"), shown
                //           only when both fields are configured.
                rollDiceLabel: isRollable && !iconOnlyRoll ? `${rollCount}d` : "",
                rollMultLabel:
                    isRollable && !iconOnlyRoll && mult > 0 && maxv > 0
                        ? `${mult}\u00d7${maxv}`
                        : "",
                iconOnlyRoll,
                useTooltip: iconOnlyRoll
                    ? game.i18n.localize("FARKPG.Items.useTooltipOpenTable")
                    : mult > 0 && maxv > 0
                      ? game.i18n.format("FARKPG.Items.useTooltip", {
                            multiplier: mult,
                            max: maxv,
                        })
                      : game.i18n.localize("FARKPG.Items.useTooltipSimple"),
                consumptionBadges,
                equipmentSlotsBonus,
                inventorySlotsBonus,
                hasSlotBonus: equipmentSlotsBonus > 0 || inventorySlotsBonus > 0,
                attachedSkill,
                attachedSkillLabel,
                ammoEnabled,
                ammoPerUse: ammoEnabled ? Math.max(1, Number(sys.ammo?.perUse ?? 1)) : 0,
                linkedAmmo: linkedAmmo
                    ? {
                          id: linkedAmmo.id,
                          name: linkedAmmo.name,
                          img: linkedAmmo.img,
                          qty: Number(linkedAmmo.system?.quantity?.value ?? 0),
                      }
                    : null,
            };
        };

        const equippedRaw = items.filter(isEquipped).sort((a, b) => a.sort - b.sort);
        const inventoryRaw = items.filter(inInventory).sort((a, b) => a.sort - b.sort);

        context.equippedItems = equippedRaw.map(decorate);
        context.inventoryItems = inventoryRaw.map(decorate);
        context.abilities = items
            .filter(isAbility)
            .sort((a, b) => a.sort - b.sort)
            .map((item) => {
                const sys = item.system ?? {};
                const descPlain = this.#htmlToPlainDescription(sys.description ?? "");
                return {
                    id: item.id,
                    uuid: item.uuid,
                    name: item.name,
                    img: item.img,
                    system: sys,
                    descPlain,
                    hasDesc: descPlain.length > 0,
                };
            });

        const linkedAmmoIds = new Set(
            context.equippedItems
                .concat(context.inventoryItems)
                .map((i) => i.linkedAmmo?.id)
                .filter(Boolean),
        );
        context.linkedAmmoItems = items
            .filter((i) => linkedAmmoIds.has(i.id))
            .map((i) => ({
                id: i.id,
                uuid: i.uuid,
                name: i.name,
                img: i.img,
                qty: Number(i.system?.quantity?.value ?? 0),
                max: Number(i.system?.quantity?.max ?? 0),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const slotMaxes = this.#computeSlotMaxes();
        context.slots = {
            equipment: {
                count: context.equippedItems.length,
                max: slotMaxes.equipment,
                base: Number(system.config?.equipmentSlots ?? 0),
                bonus: slotMaxes.equipment - Number(system.config?.equipmentSlots ?? 0),
            },
            inventory: {
                count: context.inventoryItems.length,
                max: slotMaxes.inventory,
                base: Number(system.config?.inventorySlots ?? 0),
                bonus: slotMaxes.inventory - Number(system.config?.inventorySlots ?? 0),
            },
        };

        context.attributeBlocks = ATTRIBUTE_KEYS.map((key) => this.#buildAttributeBlock(key, system));
        context.inventoryItemTypes = INVENTORY_ITEM_TYPES;
        context.apTypes = buildApTypeRowsForActor(this.actor);

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
        if (partId === "config") {
            const map = this.actor.system?.resources?.customActionPoints ?? {};
            context.customApEntries = Object.entries(map)
                .map(([id, entry]) => {
                    const e = entry && typeof entry === "object" ? entry : {};
                    const img = String(e.img ?? "").trim();
                    return {
                        id,
                        name: String(e.name ?? ""),
                        value: Number(e.value ?? 0),
                        img,
                        imgResolved: img || CUSTOM_AP_IMG_FALLBACK,
                        nameInputName: `system.resources.customActionPoints.${id}.name`,
                        valueInputName: `system.resources.customActionPoints.${id}.value`,
                        imgInputName: `system.resources.customActionPoints.${id}.img`,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        return context;
    }

    /**
     * Resolve a localization key, returning an empty string when the key has no
     * translation. `game.i18n.localize` returns the raw key when missing, which
     * would otherwise leak into tooltips.
     * @param {string} key
     * @returns {string}
     */
    #localizeOptional(key) {
        const value = game.i18n.localize(key);
        return value === key ? "" : value;
    }

    /**
     * Strip tags from an item description for a one-line summary on the actor sheet.
     * @param {string} html
     * @returns {string}
     */
    #htmlToPlainDescription(html) {
        const raw = String(html ?? "");
        const text = raw
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return text;
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
            hint: this.#localizeOptional(`FARKPG.Skills.${skillKey}Hint`),
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
                hint: "",
                value: Number(s.value ?? 0),
                inputName: `system.customSkills.${s.id}.value`,
                nameInputName: `system.customSkills.${s.id}.name`,
            }));

        return {
            key,
            label: game.i18n.localize(`FARKPG.Attributes.${key}`),
            hint: this.#localizeOptional(`FARKPG.Attributes.${key}Hint`),
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
        const apBlock = foundry.utils.getProperty(data, "system.resources.actionPoints");
        if (apBlock && typeof apBlock === "object") {
            const maxFromData = apBlock.max;
            const maxFromActor = Number(this.actor.system?.resources?.actionPoints?.max ?? 0);
            const max = maxFromData !== undefined ? Number(maxFromData) : maxFromActor;
            const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
            if ("value" in apBlock) {
                apBlock.value = clamp(apBlock.value, 0, finiteMax);
            }
        }
        const customAp = foundry.utils.getProperty(data, "system.resources.customActionPoints");
        if (customAp && typeof customAp === "object") {
            for (const entry of Object.values(customAp)) {
                if (entry && typeof entry === "object" && "value" in entry) {
                    const v = Number(entry.value);
                    entry.value = Number.isFinite(v) ? Math.max(0, Math.min(99999, v)) : 0;
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

        this._renderListeners?.abort();
        this._renderListeners = new AbortController();
        const { signal } = this._renderListeners;

        this.element.addEventListener("dragstart", this.#onDragStart.bind(this), { signal });

        // Header AP remove lives outside the tab body; ensure clicks still run the
        // same handler as `data-action` (and run before other listeners).
        this.element.addEventListener(
            "click",
            async (event) => {
                const btn = event.target.closest?.("button[data-action='removeCustomApType'][data-custom-ap-id]");
                if (!btn) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                try {
                    await FarkPGCharacterSheet.#onRemoveCustomApType.call(this, event, btn);
                } catch (err) {
                    console.error(err);
                    ui.notifications?.error(err?.message ?? String(err));
                }
            },
            { capture: true, signal },
        );

        const portraitImg = this.element.querySelector(".farkpg-portrait-img[data-farkpg-portrait-picker]");
        if (portraitImg && this.isEditable) {
            portraitImg.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openActorPortraitPicker(this.actor, this.isEditable);
                },
                { signal },
            );
        }

        // Double-clicking the attached-ammo icon on a weapon card opens the
        // ammo item's sheet for editing. Delegated once at the root so it
        // survives card re-renders.
        this.element.addEventListener(
            "dblclick",
            (event) => {
                const img = event.target?.closest?.(".farkpg-card-ammo-img[data-ammo-id]");
                if (!img) return;
                event.preventDefault();
                event.stopPropagation();
                const ammoId = img.dataset.ammoId;
                const ammo = this.actor.items.get(ammoId);
                if (!ammo) return;
                ammo.sheet?.render(true);
            },
            { signal },
        );

        for (const input of this.element.querySelectorAll(".farkpg-custom-skill-name")) {
            input.addEventListener("change", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.currentTarget;
                const id = target.dataset.customId;
                const value = String(target.value ?? "").trim();
                if (!id) return;
                this.actor.update({ [`system.customSkills.${id}.name`]: value });
            }, { signal });
        }
    }

    /**
     * Start a Foundry-compatible Item drag using the embedded item's UUID.
     * @param {DragEvent} event
     */
    #onDragStart(event) {
        const row = event.target?.closest?.("[data-item-id][draggable='true']");
        if (!row) return;
        const item = this.actor.items.get(row.dataset.itemId);
        if (!item) return;
        event.stopPropagation();
        event.dataTransfer?.setData(
            "text/plain",
            JSON.stringify({
                type: "Item",
                uuid: item.uuid,
                sourceActorUuid: this.actor.uuid,
            }),
        );
        event.dataTransfer?.setData(
            "application/json",
            JSON.stringify({
                type: "Item",
                uuid: item.uuid,
                sourceActorUuid: this.actor.uuid,
            }),
        );
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    }

    /**
     * Drop an Item on this actor via the V2 framework. Embedded items from another
     * actor are moved (create here, delete on source). Overriding this method
     * replaces the framework default that would otherwise create a second copy.
     * @param {DragEvent} event
     * @param {Item} item
     */
    async _onDropItem(event, item) {
        if (!item) return;
        if (item.parent === this.actor) return;
        if (!INVENTORY_ITEM_TYPES.includes(item.type)) return;

        if (item.type !== "ability" && this.#isInventoryFull()) {
            this.#warnInventoryFull();
            return;
        }

        const sourceActor = item.parent instanceof Actor ? item.parent : null;
        const itemData = item.toObject();
        delete itemData._id;
        if (itemData.system?.isEquipped !== undefined) itemData.system.isEquipped = false;
        if (itemData.system?.ammo?.linkedConsumableId !== undefined) {
            itemData.system.ammo.linkedConsumableId = "";
        }

        await this.actor.createEmbeddedDocuments("Item", [itemData]);
        if (sourceActor && sourceActor !== this.actor) {
            await this.#clearAmmoLinksTo(sourceActor, item.id);
            await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
        }
    }

    /**
     * When moving an ammo consumable away from an actor, clear any weapons still
     * pointing at it. The link is actor-local, so keeping it would leave stale IDs.
     * @param {Actor} actor
     * @param {string} itemId
     */
    async #clearAmmoLinksTo(actor, itemId) {
        const linkedWeapons = actor.items.filter((i) => {
            return i.type === "weapon" && i.system?.ammo?.linkedConsumableId === itemId;
        });
        for (const weapon of linkedWeapons) {
            await weapon.update({ "system.ammo.linkedConsumableId": "" });
        }
    }

    /**
     * Sum bonus slot values contributed by equipped equipment items, on top of
     * the actor's base config values. Bonuses on non-equipment item types or on
     * unequipped equipment are ignored.
     * @returns {{ equipment: number, inventory: number }}
     */
    #computeSlotMaxes() {
        const config = this.actor.system?.config ?? {};
        let equipmentMax = Number(config.equipmentSlots ?? 0);
        let inventoryMax = Number(config.inventorySlots ?? 0);
        for (const item of this.actor.items) {
            if (item.type !== "equipment") continue;
            if (item.system?.isEquipped !== true) continue;
            equipmentMax += Number(item.system?.equipmentSlots ?? 0);
            inventoryMax += Number(item.system?.inventorySlots ?? 0);
        }
        return { equipment: equipmentMax, inventory: inventoryMax };
    }

    /**
     * @returns {boolean}
     */
    #isInventoryFull() {
        const inventoryCount = this.actor.items.filter((i) => {
            return i.type !== "ability" && i.system?.isEquipped !== true;
        }).length;
        return inventoryCount >= this.#computeSlotMaxes().inventory;
    }

    #warnInventoryFull() {
        const inventoryCount = this.actor.items.filter((i) => {
            return i.type !== "ability" && i.system?.isEquipped !== true;
        }).length;
        ui.notifications?.warn(
            game.i18n.format("FARKPG.Notify.inventoryFull", {
                count: inventoryCount,
                max: this.#computeSlotMaxes().inventory,
            }),
        );
    }

    /**
     * Number of currently-equipped non-ability items.
     * @returns {number}
     */
    #equipmentCount() {
        return this.actor.items.filter(
            (i) => i.type !== "ability" && i.system?.isEquipped === true,
        ).length;
    }

    /**
     * @returns {boolean}
     */
    #isEquipmentFull() {
        return this.#equipmentCount() >= this.#computeSlotMaxes().equipment;
    }

    #warnEquipmentFull() {
        ui.notifications?.warn(
            game.i18n.format("FARKPG.Notify.equipmentFull", {
                count: this.#equipmentCount(),
                max: this.#computeSlotMaxes().equipment,
            }),
        );
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
     * Open the Virtual Dice Table module window and auto-roll the dice pool for
     * the row that was clicked: `count = max(1, attribute + skill)` d6s. Also
     * posts a chat message describing the roll and offers an "Open Virtual Dice
     * Table" button so other players can pop the table for themselves.
     * @this {FarkPGCharacterSheet}
     */
    static async #onOpenDiceTable(event, target) {
        event?.preventDefault();

        const attr = String(target?.dataset?.attribute ?? "");
        const skillKey = String(target?.dataset?.skill ?? "");
        const customId = String(target?.dataset?.customId ?? "");

        const resolved = this.#resolveAttrSkill({ attrKey: attr, skillKey, customId });
        const count = Math.max(1, resolved.atrValue + resolved.sklValue);
        const faces = 6;

        await this.#postFarkrollMessage({
            attrLabel: resolved.attrLabel,
            attrValue: resolved.atrValue,
            skillLabel: resolved.skillLabel,
            skillValue: resolved.sklValue,
            count,
            faces,
        });

        await this.#dispatchDiceTable({ count, faces });
    }

    /**
     * Resolve label + numeric value pairs for an attribute / skill referenced
     * by an action button or by an item's `attachedSkill` field. Shared by the
     * skill-roll, dice-table, and item-use code paths so the Farkroll chat
     * message always reports values consistently.
     * @param {{ attrKey?: string; skillKey?: string; customId?: string }} args
     */
    #resolveAttrSkill({ attrKey = "", skillKey = "", customId = "" }) {
        const system = this.actor.system ?? {};
        const atrValue = attrKey ? Number(system.attributes?.[attrKey] ?? 0) : 0;
        const attrLabel = attrKey
            ? game.i18n.localize(`FARKPG.Attributes.${attrKey}`)
            : "";

        let sklValue = 0;
        let skillLabel = "";
        if (customId) {
            const entry = system.customSkills?.[customId];
            sklValue = Number(entry?.value ?? 0);
            skillLabel =
                String(entry?.name ?? "").trim() ||
                game.i18n.localize("FARKPG.Skills.customDefault");
        } else if (skillKey) {
            sklValue = Number(system.skills?.[skillKey] ?? 0);
            skillLabel = game.i18n.localize(`FARKPG.Skills.${skillKey}`);
        }

        return { attrLabel, atrValue, skillLabel, sklValue };
    }

    /**
     * Build and broadcast the Farkroll chat card. Header reads
     * `"Farkroll: Body(3) - Melee Weapons(2)"` (omitting parts that are blank);
     * if no attribute / skill is supplied (a static multiplier roll) it collapses
     * to just `"Farkroll"`. `consumed` is a list of human-readable strings
     * describing resources spent on a `useItem` action.
     * @param {{
     *   attrLabel?: string;
     *   attrValue?: number;
     *   skillLabel?: string;
     *   skillValue?: number;
     *   count: number;
     *   faces: number;
     *   item?: Item|null;
     *   consumed?: string[];
     * }} args
     */
    async #postFarkrollMessage({
        attrLabel = "",
        attrValue = 0,
        skillLabel = "",
        skillValue = 0,
        count,
        faces,
        item = null,
        consumed = [],
    }) {
        const esc = foundry.utils.escapeHTML ?? ((s) => String(s));
        const farkroll = game.i18n.localize("FARKPG.Rolls.farkrollLabel");

        const parts = [];
        if (attrLabel) parts.push(`${attrLabel}(${attrValue})`);
        if (skillLabel) parts.push(`${skillLabel}(${skillValue})`);
        const headerBody = parts.join(" - ");
        const headerText = headerBody ? `${farkroll}: ${headerBody}` : farkroll;

        const summary = game.i18n.format("FARKPG.Rolls.dicePool", { count, faces });
        const openLabel = game.i18n.localize("FARKPG.Rolls.openTable");

        const detailLines = [];
        if (item) {
            const itemSys = item.system ?? {};
            const itemMult = Number(itemSys.rollable?.multiplier ?? 0);
            const itemMax = Number(itemSys.rollable?.max ?? 0);
            const usedLine =
                itemMult > 0 && itemMax > 0
                    ? game.i18n.format("FARKPG.Rolls.usedItemWithRoll", {
                          name: item.name,
                          multiplier: itemMult,
                          max: itemMax,
                      })
                    : game.i18n.format("FARKPG.Rolls.usedItem", { name: item.name });
            detailLines.push(
                `<li><i class="fa-solid fa-hand-fist"></i>${esc(usedLine)}</li>`,
            );
        }
        for (const line of consumed) {
            detailLines.push(`<li><i class="fa-solid fa-minus"></i>${esc(line)}</li>`);
        }
        const detailBlock = detailLines.length
            ? `<ul class="farkpg-table-roll-consume">${detailLines.join("")}</ul>`
            : "";

        const content = `
            <section class="farkpg-table-roll">
                <header class="farkpg-table-roll-title">${esc(headerText)}</header>
                <div class="farkpg-table-roll-body">
                    <i class="fa-solid fa-dice"></i>
                    <span>${esc(summary)}</span>
                </div>
                ${detailBlock}
                <button type="button"
                        class="farkpg-open-table-btn"
                        data-farkpg-action="open-virtual-table">
                    <i class="fa-solid fa-table-cells"></i>
                    <span>${esc(openLabel)}</span>
                </button>
            </section>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content,
        });
    }

    /**
     * Try the Virtual Dice Table module APIs in priority order:
     * `openStartRollAndRoll` first (auto-fills count/faces), then plain
     * `openVirtualTable`, then the legacy `globalThis.virtualDiceTable.open()`.
     *
     * A FarkPG roll can never put more than 6 dice on the table at once. Any
     * dice beyond that show up in the table's "Free Rolls" pool instead, which
     * the player can spend by double-clicking a die to re-roll it.
     *
     * @param {{ count: number; faces: number }} payload
     */
    async #dispatchDiceTable({ count, faces }) {
        const requested = Math.max(0, Number(count) || 0);
        const cappedCount = Math.min(6, requested);
        const freeRolls = Math.max(0, requested - 6);
        const api = game.modules.get("virtual-dice-table")?.api;
        if (api?.openStartRollAndRoll) {
            try {
                await api.openStartRollAndRoll({
                    count: cappedCount,
                    faces,
                    freeRolls,
                });
                return;
            } catch (err) {
                console.error("FarkPG | openStartRollAndRoll failed", err);
            }
        }
        await this.#openDiceTable();
    }

    /**
     * Open the Virtual Dice Table without starting a roll. Used when an item
     * has `rollable.enabled` checked but no formula configured -- clicking the
     * Use button is meant to be a quick shortcut to the table.
     */
    async #openDiceTable() {
        const api = game.modules.get("virtual-dice-table")?.api;
        if (api?.openVirtualTable) {
            api.openVirtualTable();
            return;
        }
        const direct = globalThis.virtualDiceTable;
        if (direct?.openVirtualTable) {
            direct.openVirtualTable();
            return;
        }
        if (direct?.open) {
            direct.open();
            return;
        }
        ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.dicetableMissing"));
    }

    /**
     * Open the compact AP drawer for this actor.
     * @this {FarkPGCharacterSheet}
     */
    static async #onOpenApDrawer(event) {
        event.preventDefault();
        await FarkPGApDrawer.open(this.actor);
    }

    /**
     * Image button or equivalent: open file picker for actor portrait.
     * @this {FarkPGCharacterSheet}
     */
    static #onEditPortrait(event) {
        event.preventDefault();
        event.stopPropagation();
        openActorPortraitPicker(this.actor, this.isEditable);
    }

    /**
     * Import JSON from the FarkPG web ZnZ builder (clipboard export).
     * @this {FarkPGCharacterSheet}
     */
    static async #onOpenCharacterImport(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.actor.canUserModify(game.user, "update")) {
            ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.noActorUpdatePermission"));
            return;
        }
        await promptCharacterImport(this.actor);
        this.render(true);
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static async #onAddCustomApType(event, target) {
        event.preventDefault();
        const id = foundry.utils.randomID();
        await this.actor.update({
            [`system.resources.customActionPoints.${id}`]: {
                id,
                name: game.i18n.localize("FARKPG.ApDrawer.customApDefaultName"),
                value: 0,
                img: "",
            },
        });
    }

    /**
     * Prompt for label, icon path, and starting amount, then add a custom AP pool.
     * @this {FarkPGCharacterSheet}
     */
    static async #onPromptAddCustomAp(event) {
        event.preventDefault();
        if (!this.actor.canUserModify(game.user, "update")) return;

        const DialogV2 = foundry.applications.api.DialogV2;
        const esc = foundry.utils.escapeHTML ?? ((s) => String(s));
        const title = game.i18n.localize("FARKPG.ApDrawer.addPoolDialogTitle");
        const lblName = esc(game.i18n.localize("FARKPG.ApDrawer.addPoolName"));
        const lblImg = esc(game.i18n.localize("FARKPG.ApDrawer.addPoolImg"));
        const lblAmt = esc(game.i18n.localize("FARKPG.ApDrawer.addPoolAmount"));
        const phImg = esc(game.i18n.localize("FARKPG.Config.customApImgPlaceholder"));
        const lblBrowse = esc(game.i18n.localize("FARKPG.ApDrawer.addPoolImgBrowse"));

        const content = `
            <div class="farkpg-ap-add-dialog">
                <div class="form-group">
                    <label for="farkpg-ap-add-name">${lblName}</label>
                    <input type="text" id="farkpg-ap-add-name" name="poolName" required />
                </div>
                <div class="form-group">
                    <label for="farkpg-ap-add-img">${lblImg}</label>
                    <div class="farkpg-ap-add-img-row">
                        <input type="text" id="farkpg-ap-add-img" name="poolImg" placeholder="${phImg}" />
                        <button type="button" class="farkpg-ap-add-img-pick" id="farkpg-ap-add-img-pick"
                                data-tooltip="${lblBrowse}" aria-label="${lblBrowse}">
                            <i class="fa-solid fa-image" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="farkpg-ap-add-amt">${lblAmt}</label>
                    <input type="number" id="farkpg-ap-add-amt" name="poolAmount" value="0" min="0" step="1" />
                </div>
            </div>
        `;

        // `modal: true` leaves a full-screen overlay above other apps; the image
        // FilePicker then renders underneath it and cannot receive clicks. Keep
        // this dialog non-modal so the picker stays usable while it is open.
        const result = await DialogV2.wait({
            window: { title },
            content,
            modal: false,
            rejectClose: false,
            render: (_event, dialog) => {
                const root = dialog.element;
                if (!root) return;
                const pick = root.querySelector("#farkpg-ap-add-img-pick");
                const inp = root.querySelector("#farkpg-ap-add-img");
                if (!pick || !inp) return;
                pick.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    openImagePathPicker(String(inp.value ?? "").trim(), (path) => {
                        inp.value = path;
                    });
                });
            },
            buttons: [
                {
                    action: "cancel",
                    type: "button",
                    label: game.i18n.localize("Cancel"),
                },
                {
                    action: "confirm",
                    type: "submit",
                    default: true,
                    label: game.i18n.localize("FARKPG.ApDrawer.addPoolConfirm"),
                    callback: (_event, _button, dialog) => {
                        const root = dialog.element;
                        const name = String(root.querySelector("#farkpg-ap-add-name")?.value ?? "").trim();
                        const img = String(root.querySelector("#farkpg-ap-add-img")?.value ?? "").trim();
                        const amount = Math.max(
                            0,
                            Math.floor(Number(root.querySelector("#farkpg-ap-add-amt")?.value ?? 0)),
                        );
                        return { name, img, amount };
                    },
                },
            ],
        });

        if (result === false || result == null) return;
        if (typeof result !== "object" || !("name" in result)) return;

        if (!String(result.name ?? "").trim()) {
            ui.notifications?.warn(game.i18n.localize("FARKPG.ApDrawer.addPoolNameRequired"));
            return;
        }

        const id = foundry.utils.randomID();
        const name = String(result.name ?? "").trim();
        const img = String(result.img ?? "").trim();
        await this.actor.update({
            [`system.resources.customActionPoints.${id}`]: {
                id,
                name,
                value: Number.isFinite(result.amount) ? result.amount : 0,
                img,
            },
        });
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static async #onRemoveCustomApType(event, target) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.actor.canUserModify(game.user, "update")) {
            ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.noActorUpdatePermission"));
            return;
        }
        const btn = target?.closest?.("[data-custom-ap-id]");
        const id = String(btn?.dataset?.customApId ?? target?.dataset?.customApId ?? "");
        if (!id) return;

        const pools = this.actor.system?.resources?.customActionPoints;
        const pool = pools && typeof pools === "object" ? pools[id] : null;
        const poolLabel =
            (pool && typeof pool === "object" && String(pool.name ?? "").trim()) ||
            game.i18n.localize("FARKPG.ApDrawer.customApDefaultName");
        const esc = foundry.utils.escapeHTML ?? ((s) => String(s));
        const DialogV2 = foundry.applications.api.DialogV2;
        const title = game.i18n.localize("FARKPG.Header.removeCustomApConfirmTitle");
        const body = game.i18n.format("FARKPG.Header.removeCustomApConfirmBody", {
            name: esc(poolLabel),
        });

        const agreed = await DialogV2.wait({
            window: { title },
            content: `<p class="farkpg-dialog-confirm">${body}</p>`,
            modal: true,
            rejectClose: false,
            buttons: [
                {
                    action: "cancel",
                    type: "button",
                    default: true,
                    label: game.i18n.localize("Cancel"),
                },
                {
                    action: "confirm",
                    type: "submit",
                    label: game.i18n.localize("FARKPG.Header.removeCustomApConfirmDelete"),
                    callback: () => true,
                },
            ],
        });

        const confirmed =
            agreed === true ||
            agreed === "confirm" ||
            (agreed && typeof agreed === "object" && agreed.action === "confirm");
        if (!confirmed) return;

        await deleteSystemKeyedEntry(this.actor, "system.resources.customActionPoints", id);
    }

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
     * Remove a custom skill by ID.
     * @this {FarkPGCharacterSheet}
     */
    static async #onRemoveCustomSkill(event, target) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.actor.canUserModify(game.user, "update")) return;
        const btn = target?.closest?.("[data-custom-id]") ?? target;
        const id = String(btn?.dataset?.customId ?? "");
        if (!id) return;
        await deleteSystemKeyedEntry(this.actor, "system.customSkills", id);
    }

    /**
     * Create a new embedded item of the given type and open its sheet.
     * @this {FarkPGCharacterSheet}
     */
    static async #onCreateItem(event, target) {
        event.preventDefault();
        const type = String(target.dataset.itemType ?? "");
        if (!INVENTORY_ITEM_TYPES.includes(type)) return;
        if (type !== "ability" && this.#isInventoryFull()) {
            this.#warnInventoryFull();
            return;
        }
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
        // Unequipping is always allowed even when it pushes the inventory
        // count above its current max -- the slot counter will simply turn
        // red until the player rebalances things. Equipping, however, is
        // blocked when the equipment slot is already full.
        const next = !item.system?.isEquipped;
        if (next && this.#isEquipmentFull()) {
            this.#warnEquipmentFull();
            return;
        }
        await item.update({ "system.isEquipped": next });
    }

    /**
     * Open a prompt to attach a consumable as the weapon's ammo. Filters the
     * candidate list by the weapon's `system.ammo.requiredNames` CSV when set,
     * so only matching consumables can be selected.
     * @this {FarkPGCharacterSheet}
     */
    static async #onSelectAmmo(event, target) {
        event.preventDefault();
        event.stopPropagation();
        const id = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(id);
        if (!item || item.type !== "weapon") return;
        if (item.system?.ammo?.enabled !== true) return;

        const requiredCSV = String(item.system.ammo.requiredNames ?? "").trim();
        const allowed = requiredCSV
            ? requiredCSV
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean)
            : null;

        const candidates = this.actor.items.filter((i) => {
            if (i.type !== "consumable") return false;
            if (i.id === item.id) return false;
            if (allowed && !allowed.includes(String(i.name).toLowerCase())) return false;
            return true;
        });

        if (!candidates.length) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.noAmmoCandidates", {
                    name: item.name,
                    required: requiredCSV || game.i18n.localize("FARKPG.Items.requiredAmmoAny"),
                }),
            );
            return;
        }

        const escape = foundry.utils.escapeHTML ?? ((s) => String(s));
        const optionsHtml = candidates
            .map((c) => {
                const qty = Number(c.system?.quantity?.value ?? 0);
                return `<option value="${escape(c.id)}">${escape(c.name)} (${qty})</option>`;
            })
            .join("");

        const content = `
            <p>${escape(game.i18n.format("FARKPG.Items.selectAmmoPrompt", { name: item.name }))}</p>
            <div class="form-group">
                <label for="farkpg-ammo-pick">${escape(game.i18n.localize("FARKPG.Items.ammoItem"))}</label>
                <select id="farkpg-ammo-pick" name="ammoId">${optionsHtml}</select>
            </div>
        `;

        const DialogV2 = foundry.applications.api.DialogV2;
        const chosenId = await DialogV2.prompt({
            window: { title: game.i18n.localize("FARKPG.Items.selectAmmoTitle") },
            content,
            modal: true,
            rejectClose: false,
            ok: {
                label: game.i18n.localize("FARKPG.Items.selectAmmoConfirm"),
                callback: (_event, button) => button.form?.elements?.ammoId?.value ?? null,
            },
        });

        if (!chosenId) return;
        await item.update({ "system.ammo.linkedConsumableId": chosenId });
    }

    /**
     * Use an item: spend ammo / durability / quantity (in that order) then open
     * the Virtual Dice Table. Weapons require `rollable.enabled`; if a skill is
     * attached the roll becomes `(attribute + skill)` dice with `faces = max`
     * (default 6 if unset), otherwise the static `multiplier × max` is used.
     * Any failure short-circuits with a notification and no resources are spent.
     * @this {FarkPGCharacterSheet}
     */
    static async #onUseItem(event, target) {
        event.preventDefault();
        const id = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(id);
        if (!item) return;

        const sys = item.system ?? {};
        const multiplier = Number(sys.rollable?.multiplier ?? 0);
        const max = Number(sys.rollable?.max ?? 0);
        const usesRollEnabled =
            item.type === "weapon" ||
            item.type === "equipment" ||
            item.type === "consumable";
        const attachedSkill = usesRollEnabled
            ? String(sys.rollable?.attachedSkill ?? "")
            : "";
        const rollEnabledFlag = sys.rollable?.enabled === true;

        const baselineRollable = multiplier > 0 && max > 0;
        const hasFormula = attachedSkill !== "" || baselineRollable;
        const rollable = usesRollEnabled ? rollEnabledFlag : hasFormula;
        if (!rollable) {
            ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.notRollable"));
            return;
        }

        // Roll-enabled item with no formula configured: just open the dice
        // table for manual rolling. Nothing is consumed and no chat message
        // is posted -- this is purely a shortcut to bring up the table.
        if (usesRollEnabled && rollEnabledFlag && !hasFormula) {
            await this.#openDiceTable();
            return;
        }

        // Pre-validate everything before mutating any document. Build a list of
        // updates and a parallel list of human-readable consumption strings.
        // Both lists are applied / posted only after every check passes.
        const updates = [];
        const consumed = [];

        if (item.type === "weapon" && sys.ammo?.enabled) {
            const linkedId = String(sys.ammo.linkedConsumableId ?? "");
            if (!linkedId) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.ammoNotSelected", { name: item.name }),
                );
                return;
            }
            const ammo = this.actor.items.get(linkedId);
            if (!ammo) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.ammoMissing", { name: item.name }),
                );
                return;
            }
            const requiredCSV = String(sys.ammo.requiredNames ?? "").trim();
            if (requiredCSV) {
                const allowed = requiredCSV
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => s.toLowerCase());
                if (!allowed.includes(String(ammo.name).toLowerCase())) {
                    ui.notifications?.warn(
                        game.i18n.format("FARKPG.Notify.ammoNotAllowed", {
                            ammo: ammo.name,
                            name: item.name,
                            required: requiredCSV,
                        }),
                    );
                    return;
                }
            }
            const perUse = Math.max(1, Number(sys.ammo.perUse ?? 1));
            const have = Number(ammo.system?.quantity?.value ?? 0);
            if (have < perUse) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.ammoOut", {
                        ammo: ammo.name,
                        name: item.name,
                        need: perUse,
                        have,
                    }),
                );
                return;
            }
            updates.push({ doc: ammo, data: { "system.quantity.value": have - perUse } });
            consumed.push(
                game.i18n.format("FARKPG.Rolls.consumedAmmo", {
                    amount: perUse,
                    name: ammo.name,
                }),
            );
        }

        if (item.type === "weapon") {
            const dpu = Number(sys.durabilityPerUse ?? 0);
            if (dpu > 0) {
                const dur = Number(sys.durability?.value ?? 0);
                if (dur < dpu) {
                    ui.notifications?.warn(
                        game.i18n.format("FARKPG.Notify.durabilityOut", {
                            name: item.name,
                            need: dpu,
                            have: dur,
                        }),
                    );
                    return;
                }
                updates.push({ doc: item, data: { "system.durability.value": dur - dpu } });
                consumed.push(
                    game.i18n.format("FARKPG.Rolls.consumedDurability", { amount: dpu }),
                );
            }
        }

        if (item.type === "consumable") {
            const qty = Number(sys.quantity?.value ?? 0);
            if (qty < 1) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.consumableEmpty", { name: item.name }),
                );
                return;
            }
            updates.push({ doc: item, data: { "system.quantity.value": qty - 1 } });
            consumed.push(game.i18n.localize("FARKPG.Rolls.consumedQuantity"));
        }

        for (const { doc, data } of updates) {
            await doc.update(data);
        }

        let count = multiplier;
        let faces = max;
        let resolved = { attrLabel: "", atrValue: 0, skillLabel: "", sklValue: 0 };
        if (attachedSkill) {
            const [attrKey, sKey] = attachedSkill.split(".");
            resolved = this.#resolveAttrSkill({ attrKey, skillKey: sKey });
            count = Math.max(1, resolved.atrValue + resolved.sklValue);
            faces = max > 0 ? max : 6;
        }

        await this.#postFarkrollMessage({
            attrLabel: resolved.attrLabel,
            attrValue: resolved.atrValue,
            skillLabel: resolved.skillLabel,
            skillValue: resolved.sklValue,
            count,
            faces,
            item,
            consumed,
        });

        await this.#dispatchDiceTable({ count, faces });
    }

    /**
     * @this {FarkPGCharacterSheet}
     */
    static #onToggleBiographyEditor(event) {
        event.preventDefault();
        this._biographyEditing = !this._biographyEditing;
        this.render(true);
    }

    /**
     * Flip the Attributes & Skills sidebar between view and edit modes.
     * @this {FarkPGCharacterSheet}
     */
    static #onToggleSkillsEdit(event) {
        event.preventDefault();
        this._skillsEditing = !this._skillsEditing;
        this.render(true);
    }
}
