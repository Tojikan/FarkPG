import { SYSTEM_ID } from "./config.mjs";
import { bindDeltaPopover } from "./resource-delta-popover.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Preset action currency keys (order = display left → right). */
export const ACTION_CURRENCY_KEYS = ["white", "red", "blue", "orange", "black"];

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
            return e && typeof e === "object" && Number.isFinite(Number(e.value));
        });
    if (complete) return;

    const next = {};
    for (const k of ACTION_CURRENCY_KEYS) {
        const existing = ac?.[k];
        const v = Math.max(0, Math.trunc(Number(existing?.value ?? 0)) || 0);
        next[k] = { value: v };
    }

    const legacyAp = Math.max(0, Math.trunc(Number(r?.actionPoints?.value ?? 0)) || 0);
    const hasAnyStored =
        ac &&
        ACTION_CURRENCY_KEYS.some((k) => (Math.trunc(Number(ac[k]?.value ?? 0)) || 0) > 0);
    if (legacyAp > 0 && !hasAnyStored) {
        next.white = { value: legacyAp };
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
    const chipCount = Math.min(20, raw);
    return {
        chipCount,
        chipCountClass: `farkpg-chips-${chipCount}`,
        chipOver: raw > 20,
        chipDual: chipCount > 10,
    };
}

/**
 * Rows for the five preset currencies (header + drawer).
 * @param {Actor} actor
 */
export function buildApTypeRowsForActor(actor) {
    const ac = actor.system?.resources?.actionCurrency ?? {};
    return ACTION_CURRENCY_KEYS.map((id) => {
        const entry = ac[id];
        const value = Math.max(0, Math.trunc(Number(entry?.value ?? 0)) || 0);
        const chip = buildChipDisplayMeta(value);
        return {
            kind: "currency",
            id,
            label: game.i18n.localize(`FARKPG.ActionCurrency.${id}`),
            chipClass: `farkpg-chip-tone--${id}`,
            chipStackSize: "",
            chipCount: chip.chipCount,
            chipCountClass: chip.chipCountClass,
            chipOver: chip.chipOver,
            chipDual: chip.chipDual,
            value,
            valueDisplay: formatPlainInt(value),
            valuePath: `system.resources.actionCurrency.${id}.value`,
            valueInputName: `system.resources.actionCurrency.${id}.value`,
            hasMax: false,
            maxDisplay: "",
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
        position: { width: 720, height: 320 },
        window: { resizable: true, icon: "fa-solid fa-coins" },
        actions: {
            decrementApFromDrawer: FarkPGApDrawer.#onDecrement,
        },
    };

    /** @inheritDoc */
    static PARTS = {
        body: {
            template: `systems/${SYSTEM_ID}/templates/ap-drawer.hbs`,
            scrollable: [""],
        },
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        await ensureActorActionCurrency(this.actor);
        context.apTypes = buildApTypeRowsForActor(this.actor);
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
        if (path.startsWith("system.resources.actionCurrency.") && path.endsWith(".value")) {
            await actor.update({ [path]: n });
            await this.render();
        }
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

        if (kind === "currency" && id && ACTION_CURRENCY_KEYS.includes(id)) {
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
