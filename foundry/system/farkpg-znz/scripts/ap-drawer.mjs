import { SYSTEM_ID } from "./config.mjs";
import { buildEquippedItemCards } from "./item-card-context.mjs";
import { bindDeltaPopover } from "./resource-delta-popover.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Stored action currency keys (data model; migration/import). */
export const ACTION_CURRENCY_KEYS = ["white", "red", "blue", "orange", "black"];

/** Single pool shown in the UI (white chips). */
export const ACTION_CURRENCY_DISPLAY_KEYS = ["white"];

/** Max chips rendered in the stack (8 columns × 5). */
export const CHIP_DISPLAY_MAX = 40;

/** Vertical offset per chip layer in a column (chip 1 = 5px, chip 2 = 10px, …). */
export const CHIP_STACK_OFFSET_PX = 5;

/**
 * @param {number} n
 * @returns {string} Plain integer string (no thousands separators).
 */
function formatPlainInt(n) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return "0";
    return String(v);
}

/**
 * @param {Actor|{ system?: object }} actorOrCtx
 * @param {string} [id]
 */
export function getActionCurrencyMax(actorOrCtx, id = ACTION_CURRENCY_DISPLAY_KEYS[0]) {
    return Math.max(
        0,
        Math.trunc(Number(actorOrCtx?.system?.resources?.actionCurrency?.[id]?.max ?? 0)) || 0,
    );
}

/**
 * @param {number} max
 * @param {number} rawValue
 */
export function clampActionCurrencyValueWithMax(max, rawValue) {
    const v = Math.max(0, Math.trunc(Number(rawValue)) || 0);
    const finiteMax = Math.trunc(Number(max)) || 0;
    return finiteMax > 0 ? Math.min(finiteMax, v) : v;
}

/** @param {Actor} actor @param {string} id @param {number} rawValue */
export function clampActionCurrencyValue(actor, id, rawValue) {
    return clampActionCurrencyValueWithMax(getActionCurrencyMax(actor, id), rawValue);
}

/**
 * Ensure the actor has `system.resources.actionCurrency` with all five keys.
 * Migrates legacy `actionPoints` / `customActionPoints` once.
 *
 * @param {Actor} actor
 */
export async function ensureActorActionCurrency(actor) {
    if (!actor?.canUserModify?.(game.user, "update")) return;
    const r = actor.system?.resources;
    const ac = r?.actionCurrency;
    const complete =
        ac &&
        typeof ac === "object" &&
        ACTION_CURRENCY_KEYS.every((k) => {
            const e = ac[k];
            return (
                e &&
                typeof e === "object" &&
                Number.isFinite(Number(e.value)) &&
                Number.isFinite(Number(e.max))
            );
        });
    if (complete) return;

    const next = {};
    for (const k of ACTION_CURRENCY_KEYS) {
        const existing = ac?.[k];
        const defaultMax = k === "white" ? CHIP_DISPLAY_MAX : 0;
        const max = Math.max(0, Math.trunc(Number(existing?.max ?? defaultMax)) || 0);
        const rawVal = Math.max(0, Math.trunc(Number(existing?.value ?? 0)) || 0);
        next[k] = {
            max,
            value: clampActionCurrencyValueWithMax(max, rawVal),
        };
    }

    const legacyAp = Math.max(0, Math.trunc(Number(r?.actionPoints?.value ?? 0)) || 0);
    const legacyApMax = Math.max(0, Math.trunc(Number(r?.actionPoints?.max ?? 0)) || 0);
    const hasAnyStored =
        ac &&
        ACTION_CURRENCY_KEYS.some((k) => (Math.trunc(Number(ac[k]?.value ?? 0)) || 0) > 0);
    if (!hasAnyStored && legacyAp > 0) {
        const max = legacyApMax > 0 ? legacyApMax : next.white.max;
        next.white = {
            max,
            value: clampActionCurrencyValueWithMax(max, legacyAp),
        };
    }

    await actor.update({ "system.resources.actionCurrency": next });

    const res = actor.system?.resources ?? {};
    const delOpts = { performDeletions: true };
    if ("actionPoints" in res) {
        await actor.update({ "system.resources.-=actionPoints": null }, delOpts);
    }
    if ("customActionPoints" in res) {
        await actor.update({ "system.resources.-=customActionPoints": null }, delOpts);
    }
}

/**
 * Chip display metadata for CSS-driven stacks (`farkpg-chips-{count}` on parent).
 * @param {number} value  Raw currency pool size.
 */
export function buildChipDisplayMeta(value) {
    const raw = Math.max(0, Math.trunc(Number(value)) || 0);
    const chipCount = Math.min(CHIP_DISPLAY_MAX, raw);
    const colCount = chipCount <= 0 ? 0 : Math.min(8, Math.ceil(chipCount / 5));
    return {
        chipCount,
        chipColCount: colCount,
        chipCountClass: `farkpg-chips-${chipCount}`,
        chipColsClass: `farkpg-chips-cols-${colCount}`,
        chipOver: raw > CHIP_DISPLAY_MAX,
    };
}

/**
 * Apply chip/column visibility after render. Foundry partials only receive explicit
 * hash params, so we also drive display from `data-chip-count` on each stack.
 *
 * @param {ParentNode|null|undefined} root
 */
export function applyChipStackVisibility(root) {
    if (!root?.querySelectorAll) return;

    for (const stack of root.querySelectorAll(".farkpg-chip-stack")) {
        const rawAttr = stack.dataset.chipCount;
        let raw = NaN;
        if (rawAttr !== undefined && rawAttr !== "") {
            raw = Math.trunc(Number(rawAttr));
        }
        if (!Number.isFinite(raw)) {
            const fromClass = [...stack.classList].find((c) => /^farkpg-chips-\d+$/.test(c));
            raw = fromClass ? Math.trunc(Number(fromClass.replace("farkpg-chips-", ""))) : 0;
        }
        raw = Math.max(0, raw);
        const count = Math.min(CHIP_DISPLAY_MAX, raw);
        const cols = count <= 0 ? 0 : Math.min(8, Math.ceil(count / 5));

        for (let i = 0; i <= CHIP_DISPLAY_MAX; i++) stack.classList.remove(`farkpg-chips-${i}`);
        for (let i = 0; i <= 8; i++) stack.classList.remove(`farkpg-chips-cols-${i}`);
        stack.classList.toggle("farkpg-chips-over", raw > CHIP_DISPLAY_MAX);

        if (count <= 0) {
            stack.classList.add("farkpg-chips-0");
            stack.style.display = "none";
            continue;
        }

        stack.style.display = "inline-flex";
        stack.classList.add(`farkpg-chips-${count}`, `farkpg-chips-cols-${cols}`);

        for (let c = 1; c <= 8; c++) {
            const col = stack.querySelector(`.farkpg-chip-column--${c}`);
            if (!col) continue;
            col.style.display = c <= cols ? "block" : "none";
        }

        for (let n = 1; n <= CHIP_DISPLAY_MAX; n++) {
            const chip = stack.querySelector(`.farkpg-chip--${n}`);
            if (!chip) continue;
            if (n <= count) {
                const layer = (n - 1) % 5;
                chip.style.display = "block";
                chip.style.setProperty("--chip-layer", String(layer));
                chip.style.bottom = `${(layer + 1) * CHIP_STACK_OFFSET_PX}px`;
            } else {
                chip.style.display = "none";
            }
        }
    }
}

/**
 * Apply a typed update to one action-currency pool, clamping value to max.
 * @param {Actor} actor
 * @param {string} path e.g. `system.resources.actionCurrency.white.value`
 * @param {number} n
 */
export async function applyActionCurrencyPathUpdate(actor, path, n) {
    const match = /^system\.resources\.actionCurrency\.([^.]+)\.(value|max)$/.exec(String(path ?? ""));
    if (!match) return;
    const id = match[1];
    const field = match[2];
    if (field === "max") {
        const max = Math.max(0, Math.trunc(Number(n)) || 0);
        const cur = Math.trunc(Number(actor.system?.resources?.actionCurrency?.[id]?.value ?? 0)) || 0;
        const value = clampActionCurrencyValueWithMax(max, cur);
        /** @type {Record<string, number>} */
        const update = { [`system.resources.actionCurrency.${id}.max`]: max };
        if (value !== cur) update[`system.resources.actionCurrency.${id}.value`] = value;
        await actor.update(update);
        return;
    }
    const value = clampActionCurrencyValue(actor, id, n);
    await actor.update({ [`system.resources.actionCurrency.${id}.value`]: value });
}

/**
 * Rows for the five preset currencies (header + drawer).
 * @param {Actor} actor
 */
export function buildApTypeRowsForActor(actor) {
    const ac = actor.system?.resources?.actionCurrency ?? {};
    return ACTION_CURRENCY_DISPLAY_KEYS.map((id) => {
        const entry = ac[id];
        const max = getActionCurrencyMax(actor, id);
        const value = clampActionCurrencyValue(actor, id, entry?.value ?? 0);
        const chip = buildChipDisplayMeta(value);
        return {
            kind: "currency",
            id,
            label: game.i18n.localize(`FARKPG.ActionCurrency.${id}`),
            chipClass: `farkpg-chip-tone--${id}`,
            chipStackSize: "",
            chipCount: chip.chipCount,
            chipColCount: chip.chipColCount,
            chipCountClass: chip.chipCountClass,
            chipOver: chip.chipOver,
            chipColsClass: chip.chipColsClass,
            value,
            max,
            valueDisplay: formatPlainInt(value),
            maxDisplay: formatPlainInt(max),
            valuePath: `system.resources.actionCurrency.${id}.value`,
            maxPath: `system.resources.actionCurrency.${id}.max`,
            valueInputName: `system.resources.actionCurrency.${id}.value`,
            hasMax: true,
        };
    });
}

/** @type {Map<string, FarkPGApDrawer>} */
const _openByActorId = new Map();

/**
 * Pop-out window: health + five action currencies (quick spend on icon).
 */
export class FarkPGApDrawer extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @type {AbortController|null} */
    _inputListeners = null;

    /** @param {Actor} actor */
    constructor(actor) {
        if (!actor?.id) throw new Error("FarkPGApDrawer requires an actor with an id.");
        super({
            id: `farkpg-ap-drawer-${actor.id}`,
            window: { title: game.i18n.localize("FARKPG.ApDrawer.title") },
        });
        /** @type {Actor} */
        this._actor = actor;
    }

    /** @returns {Actor} */
    get actor() {
        return game.actors.get(this._actor.id) ?? this._actor;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ["farkpg", "ap-drawer"],
        tag: "section",
        position: { width: 780, height: 540 },
        window: { resizable: true, icon: "fa-solid fa-coins" },
        actions: {
            decrementApFromDrawer: FarkPGApDrawer.#onDecrement,
            useItem: FarkPGApDrawer.#onUseItem,
        },
    };

    /** @inheritDoc */
    static PARTS = {
        body: {
            template: `systems/${SYSTEM_ID}/templates/ap-drawer.hbs`,
            scrollable: [".farkpg-ap-drawer-window"],
        },
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        await ensureActorActionCurrency(this.actor);
        context.apTypes = buildApTypeRowsForActor(this.actor);
        context.equippedItems = buildEquippedItemCards(this.actor);
        context.editable = this.actor.canUserModify(game.user, "update");

        const health = this.actor.system?.resources?.health ?? {};
        const hpValue = Math.max(0, Math.trunc(Number(health.value ?? 0)) || 0);
        const hpMax = Math.max(0, Math.trunc(Number(health.max ?? 0)) || 0);
        context.health = {
            value: hpValue,
            max: hpMax,
            valueDisplay: formatPlainInt(hpValue),
            maxDisplay: formatPlainInt(hpMax),
        };

        const exp = this.actor.system?.resources?.exp ?? {};
        const expValue = Math.max(0, Math.trunc(Number(exp.value ?? 0)) || 0);
        const expMax = Math.max(0, Math.trunc(Number(exp.max ?? 0)) || 0);
        context.exp = {
            value: expValue,
            max: expMax,
            valueDisplay: formatPlainInt(expValue),
            maxDisplay: formatPlainInt(expMax),
        };

        return context;
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        applyChipStackVisibility(this.element);
        requestAnimationFrame(() => applyChipStackVisibility(this.element));

        this._inputListeners?.abort();
        this._inputListeners = new AbortController();
        const { signal } = this._inputListeners;

        this.element?.addEventListener(
            "change",
            (ev) => {
                const apInp = ev.target?.closest?.("input[data-ap-path]");
                if (apInp) {
                    if (!this.actor.canUserModify(game.user, "update")) return;
                    const path = String(apInp.dataset.apPath ?? "");
                    if (!path) return;
                    const raw = Math.trunc(Number(apInp.value ?? 0));
                    const n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                    void this.#applyValueFromPath(path, n);
                    return;
                }
                const hpInp = ev.target?.closest?.("input[data-farkpg-health-value]");
                if (hpInp) {
                    if (!this.actor.canUserModify(game.user, "update")) return;
                    const raw = Math.trunc(Number(hpInp.value ?? 0));
                    const n = Number.isFinite(raw) ? raw : 0;
                    void this.#applyHealthAbsolute(n);
                }
                const expInp = ev.target?.closest?.("input[data-farkpg-exp-value]");
                if (expInp) {
                    if (!this.actor.canUserModify(game.user, "update")) return;
                    const raw = Math.trunc(Number(expInp.value ?? 0));
                    const n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                    void this.#applyExpAbsolute(n);
                }
            },
            { signal },
        );

        if (this.actor.canUserModify(game.user, "update")) {
            const hpBtn = this.element?.querySelector?.(".farkpg-drawer-hp-delta-trigger");
            const hpAnchor = hpBtn?.closest?.(".farkpg-resource-delta-anchor");
            if (hpBtn instanceof HTMLElement && hpAnchor instanceof HTMLElement) {
                bindDeltaPopover(
                    hpAnchor,
                    hpBtn,
                    async (delta) => {
                        const actor = this.actor;
                        const cur = Math.trunc(Number(actor.system?.resources?.health?.value ?? 0)) || 0;
                        const max = Math.trunc(Number(actor.system?.resources?.health?.max ?? 0)) || 0;
                        const next = cur + delta;
                        const finiteMax = Number.isFinite(max) && max > 0;
                        const clamped = finiteMax ? Math.min(max, Math.max(0, next)) : Math.max(0, next);
                        await actor.update({ "system.resources.health.value": clamped });
                        await this.render();
                    },
                    signal,
                    {
                        inputLabel: game.i18n.localize("FARKPG.ResourceDelta.hpLabel"),
                        applyLabel: game.i18n.localize("FARKPG.ResourceDelta.apply"),
                    },
                );
            }

            const expBtn = this.element?.querySelector?.(".farkpg-drawer-exp-delta-trigger");
            const expAnchor = expBtn?.closest?.(".farkpg-resource-delta-anchor");
            if (expBtn instanceof HTMLElement && expAnchor instanceof HTMLElement) {
                bindDeltaPopover(
                    expAnchor,
                    expBtn,
                    async (delta) => {
                        const actor = this.actor;
                        const cur = Math.trunc(Number(actor.system?.resources?.exp?.value ?? 0)) || 0;
                        const max = Math.trunc(Number(actor.system?.resources?.exp?.max ?? 0)) || 0;
                        const next = cur + delta;
                        const finiteMax = Number.isFinite(max) && max > 0;
                        const clamped = finiteMax ? Math.min(max, Math.max(0, next)) : Math.max(0, next);
                        await actor.update({ "system.resources.exp.value": clamped });
                        await this.render();
                    },
                    signal,
                    {
                        inputLabel: game.i18n.localize("FARKPG.ResourceDelta.expLabel"),
                        applyLabel: game.i18n.localize("FARKPG.ResourceDelta.apply"),
                    },
                );
            }

            const apBtn = this.element?.querySelector?.(".farkpg-drawer-ap-delta-trigger");
            const apAnchor = apBtn?.closest?.(".farkpg-resource-delta-anchor");
            if (apBtn instanceof HTMLElement && apAnchor instanceof HTMLElement) {
                bindDeltaPopover(
                    apAnchor,
                    apBtn,
                    async (delta) => {
                        const actor = this.actor;
                        const id = ACTION_CURRENCY_DISPLAY_KEYS[0];
                        const cur =
                            Math.trunc(
                                Number(actor.system?.resources?.actionCurrency?.[id]?.value ?? 0),
                            ) || 0;
                        const max = getActionCurrencyMax(actor, id);
                        const nextRaw = Math.max(0, cur + delta);
                        const next = max > 0 ? Math.min(max, nextRaw) : nextRaw;
                        await actor.update({
                            [`system.resources.actionCurrency.${id}.value`]: next,
                        });
                        await this.render();
                        FarkPGApDrawer.refreshIfOpen(actor.id);
                    },
                    signal,
                    {
                        inputLabel: game.i18n.localize("FARKPG.ResourceDelta.apLabel"),
                        applyLabel: game.i18n.localize("FARKPG.ResourceDelta.apply"),
                    },
                );
            }
        }
    }

    /**
     * Clamp absolute HP to `[0, max]` when max &gt; 0; otherwise floor at 0.
     * @param {number} n
     */
    async #applyHealthAbsolute(n) {
        const actor = this.actor;
        const max = Math.trunc(Number(actor.system?.resources?.health?.max ?? 0)) || 0;
        const finiteMax = Number.isFinite(max) && max > 0;
        const clamped = finiteMax ? Math.min(max, Math.max(0, n)) : Math.max(0, n);
        await actor.update({ "system.resources.health.value": clamped });
        await this.render();
    }

    /**
     * @param {number} n
     */
    async #applyExpAbsolute(n) {
        const actor = this.actor;
        const max = Math.trunc(Number(actor.system?.resources?.exp?.max ?? 0)) || 0;
        const finiteMax = Number.isFinite(max) && max > 0;
        const clamped = finiteMax ? Math.min(max, Math.max(0, n)) : Math.max(0, n);
        await actor.update({ "system.resources.exp.value": clamped });
        await this.render();
    }

    /** @inheritDoc */
    _onClose(options) {
        this._inputListeners?.abort();
        this._inputListeners = null;
        _openByActorId.delete(this._actor.id);
        return super._onClose?.(options);
    }

    /**
     * @param {string} path
     * @param {number} n
     */
    async #applyValueFromPath(path, n) {
        const actor = this.actor;
        if (
            path.startsWith("system.resources.actionCurrency.") &&
            (path.endsWith(".value") || path.endsWith(".max"))
        ) {
            await applyActionCurrencyPathUpdate(actor, path, n);
            await this.render();
        }
    }

    /**
     * @this {FarkPGApDrawer}
     */
    static async #onUseItem(event, target) {
        event.preventDefault();
        /** @type {FarkPGApDrawer} */
        const self = this;
        const { FarkPGCharacterSheet } = await import("./sheets/character-sheet.mjs");
        try {
            await FarkPGCharacterSheet.useItemForActor(self.actor, event, target);
        } catch (err) {
            console.error("FarkPG | AP drawer useItem failed", err);
            ui.notifications?.error(game.i18n.localize("FARKPG.Notify.useItemFailed"));
            return;
        }
        await self.render();
        FarkPGApDrawer.refreshIfOpen(self.actor.id);
    }

    /**
     * @this {FarkPGApDrawer}
     */
    static async #onDecrement(event, target) {
        event.preventDefault();
        /** @type {FarkPGApDrawer} */
        const self = this;
        const actor = self.actor;
        if (!actor.canUserModify(game.user, "update")) return;

        const kind = String(target.dataset.apKind ?? "");
        const id = String(target.dataset.apId ?? "");

        if (kind === "currency" && id && ACTION_CURRENCY_DISPLAY_KEYS.includes(id)) {
            const cur = Math.trunc(Number(actor.system?.resources?.actionCurrency?.[id]?.value ?? 0)) || 0;
            const next = Math.max(0, cur - 1);
            await actor.update({ [`system.resources.actionCurrency.${id}.value`]: next });
        }
        await self.render();
    }

    /** @param {Actor} actor */
    static async open(actor) {
        let app = _openByActorId.get(actor.id);
        if (app?.rendered) {
            app.bringToTop?.();
            return app;
        }
        app = new FarkPGApDrawer(actor);
        _openByActorId.set(actor.id, app);
        await app.render({ force: true });
        return app;
    }

    /** @param {string} actorId */
    static refreshIfOpen(actorId) {
        const app = _openByActorId.get(actorId);
        if (app?.rendered) void app.render();
    }
}
