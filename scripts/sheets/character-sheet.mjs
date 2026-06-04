import {
    ACTION_CURRENCY_KEYS,
    FarkPGApDrawer,
    buildApTypeRowsForActor,
    ensureActorActionCurrency,
} from "../ap-drawer.mjs";
import { promptCharacterImport } from "../character-import.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_SKILLS, INVENTORY_ITEM_TYPES, SYSTEM_ID } from "../config.mjs";
import { bindDeltaPopover } from "../resource-delta-popover.mjs";

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
 * Delete one keyed entry under `system` (e.g. `system.customSkills[id]`).
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
            decrementApFromSheet: FarkPGCharacterSheet.#onDecrementApFromSheet,
            addCustomSkill: FarkPGCharacterSheet.#onAddCustomSkill,
            removeCustomSkill: FarkPGCharacterSheet.#onRemoveCustomSkill,
            createItem: FarkPGCharacterSheet.#onCreateItem,
            editItem: FarkPGCharacterSheet.#onEditItem,
            deleteItem: FarkPGCharacterSheet.#onDeleteItem,
            toggleEquip: FarkPGCharacterSheet.#onToggleEquip,
            useItem: FarkPGCharacterSheet.#onUseItem,
            selectAmmo: FarkPGCharacterSheet.#onSelectAmmo,
            reloadAmmo: FarkPGCharacterSheet.#onReloadAmmo,
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
        let system = this.actor.system ?? {};

        context.system = system;
        context.actor = this.actor;
        context.editable = this.isEditable;
        context.canModifyActor = this.actor.canUserModify(game.user, "update");
        context.biographyEditing = this._biographyEditing;
        context.skillsEditing = this._skillsEditing;
        context.tabs = this._prepareTabs("primary");

        if (this.actor.canUserModify(game.user, "update")) {
            await ensureActorActionCurrency(this.actor);
        }
        system = this.actor.system ?? {};
        context.system = system;

        const hpV = Math.trunc(Number(system.resources?.health?.value ?? 0));
        const hpM = Math.trunc(Number(system.resources?.health?.max ?? 0));
        const expV = Math.trunc(Number(system.resources?.exp?.value ?? 0));
        const expM = Math.trunc(Number(system.resources?.exp?.max ?? 0));
        const mv = Math.trunc(Number(system.resources?.movement ?? 0));
        context.resourceDisplay = {
            hpValue: String(Number.isFinite(hpV) ? Math.max(0, hpV) : 0),
            hpMax: String(Number.isFinite(hpM) ? Math.max(0, hpM) : 0),
            expValue: String(Number.isFinite(expV) ? Math.max(0, expV) : 0),
            expMax: String(Number.isFinite(expM) ? Math.max(0, expM) : 0),
            move: String(Number.isFinite(mv) ? Math.max(0, mv) : 0),
        };

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
            // "Uses durability" = the item spends durability on every use. Cards
            // only show the durability row for items that actually wear out
            // (otherwise the field is just decoration). `isBroken` flips true
            // when such an item has hit 0 durability -- rolls and actions are
            // disabled in that state.
            const durabilityPerUse = hasDurability ? Number(sys.durabilityPerUse ?? 0) : 0;
            const usesDurability = durabilityPerUse > 0;
            const durabilityValue = hasDurability ? Number(sys.durability?.value ?? 0) : 0;
            const isBroken = usesDurability && durabilityValue <= 0;
            const ammoEnabled = isWeapon && sys.ammo?.enabled === true;
            // The weapon now holds its own loaded ammo (value/max). The
            // "reload source" is a separate consumable that refills `value`
            // up to `max` when the Reload button is pressed. `linkedConsumableId`
            // is the pre-rework name we still honour when reading old data.
            const ammoValue = ammoEnabled ? Number(sys.ammo?.value ?? 0) : 0;
            const ammoMax = ammoEnabled ? Number(sys.ammo?.max ?? 0) : 0;
            const reloadFromId = ammoEnabled
                ? String(sys.ammo?.reloadFromId ?? sys.ammo?.linkedConsumableId ?? "")
                : "";
            const reloadSourceItem = reloadFromId
                ? this.actor.items.get(reloadFromId)
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
                if (isWeapon && ammoEnabled) {
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
                usesDurability,
                isBroken,
                brokenTooltip: isBroken
                    ? game.i18n.format("FARKPG.Items.brokenTooltip", { name: item.name })
                    : "",
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
                ammoValue,
                ammoMax,
                reloadSource: reloadSourceItem
                    ? {
                          id: reloadSourceItem.id,
                          name: reloadSourceItem.name,
                          img: reloadSourceItem.img,
                          qty: Number(reloadSourceItem.system?.quantity?.value ?? 0),
                      }
                    : null,
                // Button is only hard-disabled for states the player can't
                // act on at all (broken / no capacity / already full). Missing
                // or empty source still leaves it enabled so the handler can
                // fire and explain via `ui.notifications`.
                canReload: ammoEnabled
                    && !isBroken
                    && ammoMax > 0
                    && ammoValue < ammoMax,
                reloadTooltip: ammoEnabled
                    ? (() => {
                          if (isBroken)
                              return game.i18n.format("FARKPG.Items.brokenTooltip", {
                                  name: item.name,
                              });
                          if (ammoMax <= 0)
                              return game.i18n.localize("FARKPG.Items.reloadTooltipUnconfigured");
                          if (ammoValue >= ammoMax)
                              return game.i18n.format("FARKPG.Items.reloadTooltipFull", {
                                  name: item.name,
                                  value: ammoValue,
                                  max: ammoMax,
                              });
                          return game.i18n.format("FARKPG.Items.reloadTooltip", {
                              name: item.name,
                              source: reloadSourceItem?.name ?? "—",
                              need: ammoMax - ammoValue,
                          });
                      })()
                    : "",
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
        const health = foundry.utils.getProperty(data, "system.resources.health");
        if (health && typeof health === "object") {
            const maxFromData = health.max;
            const maxFromActor = Number(this.actor.system?.resources?.health?.max ?? 0);
            const max = maxFromData !== undefined ? Number(maxFromData) : maxFromActor;
            const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
            if ("value" in health) {
                const v = Math.trunc(Number(health.value));
                const n = Number.isFinite(v) ? v : 0;
                health.value = finiteMax > 0 ? clamp(n, 0, finiteMax) : Math.max(0, n);
            }
            if ("max" in health) {
                health.max = Math.max(0, Math.trunc(Number(health.max)) || 0);
            }
        }
        const expBlock = foundry.utils.getProperty(data, "system.resources.exp");
        if (expBlock && typeof expBlock === "object") {
            const maxFromData = expBlock.max;
            const maxFromActor = Number(this.actor.system?.resources?.exp?.max ?? 0);
            const max = maxFromData !== undefined ? Number(maxFromData) : maxFromActor;
            const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
            if ("value" in expBlock) {
                const v = Math.trunc(Number(expBlock.value));
                const n = Number.isFinite(v) ? v : 0;
                expBlock.value = finiteMax > 0 ? clamp(n, 0, finiteMax) : Math.max(0, n);
            }
            if ("max" in expBlock) {
                expBlock.max = Math.max(0, Math.trunc(Number(expBlock.max)) || 0);
            }
        }
        const movePath = "system.resources.movement";
        if (foundry.utils.hasProperty(data, movePath)) {
            foundry.utils.setProperty(
                data,
                movePath,
                clamp(Math.trunc(Number(foundry.utils.getProperty(data, movePath))), 0, 9999),
            );
        }
        const ac = foundry.utils.getProperty(data, "system.resources.actionCurrency");
        if (ac && typeof ac === "object") {
            const current = this.actor.system?.resources?.actionCurrency ?? {};
            const merged = {};
            for (const id of ACTION_CURRENCY_KEYS) {
                const incoming = ac[id];
                const raw =
                    incoming && typeof incoming === "object" && "value" in incoming
                        ? incoming.value
                        : current[id]?.value;
                const v = Math.trunc(Number(raw));
                merged[id] = {
                    value: Number.isFinite(v) ? Math.max(0, Math.min(999999, v)) : 0,
                };
            }
            foundry.utils.setProperty(data, "system.resources.actionCurrency", merged);
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

        this.element.addEventListener(
            "change",
            (ev) => {
                const inp = ev.target?.closest?.("input[data-ap-path]");
                if (!inp) return;
                if (!this.isEditable || !this.actor.canUserModify(game.user, "update")) return;
                const path = String(inp.dataset.apPath ?? "");
                if (!path.startsWith("system.resources.actionCurrency.") || !path.endsWith(".value")) {
                    return;
                }
                const raw = Math.floor(Number(inp.value ?? 0));
                const n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                void this.actor.update({ [path]: n });
            },
            { signal },
        );

        if (this.isEditable && this.actor.canUserModify(game.user, "update")) {
            const hpBtn = this.element.querySelector(".farkpg-header-hp-delta");
            const hpAnchor = hpBtn?.closest?.(".farkpg-resource-delta-anchor");
            if (hpBtn instanceof HTMLElement && hpAnchor instanceof HTMLElement) {
                bindDeltaPopover(
                    hpAnchor,
                    hpBtn,
                    async (delta) => {
                        const cur = Math.trunc(Number(this.actor.system?.resources?.health?.value ?? 0)) || 0;
                        const max = Math.trunc(Number(this.actor.system?.resources?.health?.max ?? 0)) || 0;
                        const next = cur + delta;
                        const finiteMax = Number.isFinite(max) && max > 0;
                        const clamped = finiteMax ? Math.min(max, Math.max(0, next)) : Math.max(0, next);
                        await this.actor.update({ "system.resources.health.value": clamped });
                    },
                    signal,
                    {
                        inputLabel: game.i18n.localize("FARKPG.ResourceDelta.hpLabel"),
                        applyLabel: game.i18n.localize("FARKPG.ResourceDelta.apply"),
                    },
                );
            }

            const expBtn = this.element.querySelector(".farkpg-header-exp-delta");
            const expAnchor = expBtn?.closest?.(".farkpg-resource-delta-anchor");
            if (expBtn instanceof HTMLElement && expAnchor instanceof HTMLElement) {
                bindDeltaPopover(
                    expAnchor,
                    expBtn,
                    async (delta) => {
                        const cur = Math.trunc(Number(this.actor.system?.resources?.exp?.value ?? 0)) || 0;
                        const max = Math.trunc(Number(this.actor.system?.resources?.exp?.max ?? 0)) || 0;
                        const next = cur + delta;
                        const finiteMax = Number.isFinite(max) && max > 0;
                        const clamped = finiteMax ? Math.min(max, Math.max(0, next)) : Math.max(0, next);
                        await this.actor.update({ "system.resources.exp.value": clamped });
                    },
                    signal,
                    {
                        inputLabel: game.i18n.localize("FARKPG.ResourceDelta.expLabel"),
                        applyLabel: game.i18n.localize("FARKPG.ResourceDelta.apply"),
                    },
                );
            }
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
        // Ammo / reload links are actor-local — clear both the new and legacy
        // keys when copying an item to a different actor.
        if (itemData.system?.ammo?.reloadFromId !== undefined) {
            itemData.system.ammo.reloadFromId = "";
        }
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
            if (i.type !== "weapon") return false;
            const a = i.system?.ammo ?? {};
            return a.reloadFromId === itemId || a.linkedConsumableId === itemId;
        });
        for (const weapon of linkedWeapons) {
            await weapon.update({
                "system.ammo.reloadFromId": "",
                "system.ammo.linkedConsumableId": "",
            });
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
     * `openStartRollAndRoll` (opens table + **Start roll** only — no green Roll),
     * then plain `openVirtualTable`, then the legacy `globalThis.virtualDiceTable.open()`.
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
     * Spend one from a preset action currency (header strip).
     * @this {FarkPGCharacterSheet}
     */
    static async #onDecrementApFromSheet(event, target) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.actor.canUserModify(game.user, "update")) return;
        const btn = target?.closest?.("[data-ap-id]") ?? target;
        const id = String(btn?.dataset?.apId ?? "");
        if (!ACTION_CURRENCY_KEYS.includes(id)) return;
        const cur = Math.trunc(Number(this.actor.system?.resources?.actionCurrency?.[id]?.value ?? 0)) || 0;
        const next = Math.max(0, cur - 1);
        await this.actor.update({ [`system.resources.actionCurrency.${id}.value`]: next });
        const inp = this.element.querySelector(`input[data-ap-path="system.resources.actionCurrency.${id}.value"]`);
        if (inp instanceof HTMLInputElement) inp.value = String(next);
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
     * Open a prompt to pick a consumable as the weapon's reload source. The
     * candidate list is filtered by the weapon's `system.ammo.requiredNames`
     * CSV when set. Writes to `system.ammo.reloadFromId`.
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
            <p>${escape(game.i18n.format("FARKPG.Items.selectReloadPrompt", { name: item.name }))}</p>
            <div class="form-group">
                <label for="farkpg-ammo-pick">${escape(game.i18n.localize("FARKPG.Items.reloadFrom"))}</label>
                <select id="farkpg-ammo-pick" name="ammoId">${optionsHtml}</select>
            </div>
        `;

        const DialogV2 = foundry.applications.api.DialogV2;
        const chosenId = await DialogV2.prompt({
            window: { title: game.i18n.localize("FARKPG.Items.selectReloadTitle") },
            content,
            modal: true,
            rejectClose: false,
            ok: {
                label: game.i18n.localize("FARKPG.Items.selectReloadConfirm"),
                callback: (_event, button) => button.form?.elements?.ammoId?.value ?? null,
            },
        });

        if (!chosenId) return;
        await item.update({
            "system.ammo.reloadFromId": chosenId,
            // Clear the legacy field so the two never disagree.
            "system.ammo.linkedConsumableId": "",
        });
    }

    /**
     * Refill this weapon's loaded ammo up to its max, drawing the difference
     * from the consumable named in `system.ammo.reloadFromId`. Partial reloads
     * are allowed: when the source has fewer rounds than the deficit, transfer
     * everything the source has.
     * @this {FarkPGCharacterSheet}
     */
    static async #onReloadAmmo(event, target) {
        event.preventDefault();
        event.stopPropagation();
        // Resolve the item id defensively. `target` is normally the element
        // that owns `data-action`, but if Foundry's signature drifts in a
        // future minor we still want a click on the inner <i> to work.
        const root =
            target?.closest?.("[data-item-id]") ??
            event.currentTarget?.closest?.("[data-item-id]") ??
            event.target?.closest?.("[data-item-id]");
        const id = root?.dataset?.itemId;
        const item = this.actor.items.get(id);
        if (!item || item.type !== "weapon") {
            console.warn("FarkPG | reloadAmmo: could not resolve weapon item", { id, target });
            return;
        }

        const sys = item.system ?? {};
        if (sys.ammo?.enabled !== true) return;

        const dpu = Number(sys.durabilityPerUse ?? 0);
        if (dpu > 0 && Number(sys.durability?.value ?? 0) <= 0) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.broken", { name: item.name }),
            );
            return;
        }

        const ammoMax = Number(sys.ammo?.max ?? 0);
        if (ammoMax <= 0) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.ammoMaxUnset", { name: item.name }),
            );
            return;
        }
        const ammoValue = Number(sys.ammo?.value ?? 0);
        if (ammoValue >= ammoMax) {
            ui.notifications?.info(
                game.i18n.format("FARKPG.Notify.reloadFull", {
                    name: item.name,
                    value: ammoValue,
                    max: ammoMax,
                }),
            );
            return;
        }

        // Honour the legacy `linkedConsumableId` field as a fallback so existing
        // data keeps reloading without forcing the user to re-pick the source.
        const sourceId = String(sys.ammo?.reloadFromId ?? sys.ammo?.linkedConsumableId ?? "");
        if (!sourceId) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.reloadNoSource", { name: item.name }),
            );
            return;
        }
        const source = this.actor.items.get(sourceId);
        if (!source) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.reloadSourceMissing", { name: item.name }),
            );
            return;
        }
        const haveInSource = Number(source.system?.quantity?.value ?? 0);
        if (haveInSource <= 0) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.reloadSourceEmpty", {
                    name: item.name,
                    source: source.name,
                }),
            );
            return;
        }

        const need = ammoMax - ammoValue;
        const transfer = Math.min(need, haveInSource);
        const newAmmoValue = ammoValue + transfer;
        const newSourceQty = haveInSource - transfer;

        await item.update({ "system.ammo.value": newAmmoValue });
        await source.update({ "system.quantity.value": newSourceQty });

        ui.notifications?.info(
            game.i18n.format("FARKPG.Notify.reloaded", {
                name: item.name,
                amount: transfer,
                source: source.name,
                value: newAmmoValue,
                max: ammoMax,
            }),
        );
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

        // Items that wear out (durabilityPerUse > 0) refuse to be used at 0
        // durability. Done before the dice-table shortcut so a broken weapon
        // can't even open the table for a manual roll.
        const dpu = Number(sys.durabilityPerUse ?? 0);
        if (dpu > 0 && Number(sys.durability?.value ?? 0) <= 0) {
            ui.notifications?.warn(
                game.i18n.format("FARKPG.Notify.broken", { name: item.name }),
            );
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
            const ammoMax = Number(sys.ammo?.max ?? 0);
            if (ammoMax <= 0) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.ammoMaxUnset", { name: item.name }),
                );
                return;
            }
            const perUse = Math.max(1, Number(sys.ammo.perUse ?? 1));
            const have = Number(sys.ammo?.value ?? 0);
            if (have < perUse) {
                ui.notifications?.warn(
                    game.i18n.format("FARKPG.Notify.ammoOut", {
                        name: item.name,
                        need: perUse,
                        have,
                    }),
                );
                return;
            }
            const after = have - perUse;
            updates.push({ doc: item, data: { "system.ammo.value": after } });
            consumed.push(
                game.i18n.format("FARKPG.Rolls.consumedAmmo", {
                    amount: perUse,
                    value: after,
                    max: ammoMax,
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
