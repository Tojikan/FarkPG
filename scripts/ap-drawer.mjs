import { SYSTEM_ID } from "./config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const BASE_AP_IMG = "icons/svg/lightning.svg";
const CUSTOM_AP_IMG_DEFAULT = "icons/svg/aura.svg";

/**
 * @param {number} n
 * @returns {string}
 */
function formatApNumber(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    try {
        return v.toLocaleString(game.i18n?.lang ?? "en");
    } catch {
        return String(v);
    }
}

/**
 * Rows for base + custom AP, shared by the actor sheet header and the drawer app.
 * @param {Actor} actor
 */
export function buildApTypeRowsForActor(actor) {
    const system = actor.system ?? {};
    const ap = system.resources?.actionPoints ?? {};
    const rows = [
        {
            kind: "base",
            id: "base",
            label: game.i18n.localize("FARKPG.Header.ap"),
            value: Number(ap.value ?? 0),
            valueDisplay: formatApNumber(ap.value ?? 0),
            max: Number(ap.max ?? 0),
            maxDisplay: formatApNumber(ap.max ?? 0),
            hasMax: true,
            img: BASE_AP_IMG,
            valuePath: "system.resources.actionPoints.value",
            valueInputName: "system.resources.actionPoints.value",
        },
    ];

    const customMap = system.resources?.customActionPoints ?? {};
    for (const [id, entry] of Object.entries(customMap)) {
        if (!entry || typeof entry !== "object") continue;
        const name =
            String(entry.name ?? "").trim() || game.i18n.localize("FARKPG.ApDrawer.customApDefaultName");
        const img = String(entry.img ?? "").trim() || CUSTOM_AP_IMG_DEFAULT;
        rows.push({
            kind: "custom",
            id,
            label: name,
            value: Number(entry.value ?? 0),
            valueDisplay: formatApNumber(entry.value ?? 0),
            max: 0,
            maxDisplay: "",
            hasMax: false,
            img,
            valuePath: `system.resources.customActionPoints.${id}.value`,
            valueInputName: `system.resources.customActionPoints.${id}.value`,
        });
    }
    return rows;
}

/** @type {Map<string, FarkPGApDrawer>} */
const _openByActorId = new Map();

/**
 * Pop-out window for AP: quick spend on icon, or edit values inline.
 * Base AP is clamped to max; custom pools only clamp at zero.
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
        position: { width: 620, height: 240 },
        window: { resizable: true, icon: "fa-solid fa-coins" },
        actions: {
            decrementApFromDrawer: FarkPGApDrawer.#onDecrement,
            adjustHealth: FarkPGApDrawer.#onAdjustHealth,
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
        context.apTypes = buildApTypeRowsForActor(this.actor);
        context.editable = this.actor.canUserModify(game.user, "update");

        const health = this.actor.system?.resources?.health ?? {};
        const hpValue = Math.max(0, Math.floor(Number(health.value ?? 0)) || 0);
        const hpMax = Math.max(0, Math.floor(Number(health.max ?? 0)) || 0);
        context.health = {
            value: hpValue,
            max: hpMax,
            valueDisplay: formatApNumber(hpValue),
            maxDisplay: formatApNumber(hpMax),
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
                    const raw = Math.floor(Number(apInp.value ?? 0));
                    const n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                    void this.#applyValueFromPath(path, n);
                    return;
                }
                const hpInp = ev.target?.closest?.("input[data-farkpg-health-value]");
                if (hpInp) {
                    if (!this.actor.canUserModify(game.user, "update")) return;
                    const raw = Math.floor(Number(hpInp.value ?? 0));
                    const n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                    void this.#applyHealth(n);
                }
            },
            { signal },
        );
    }

    /**
     * Clamp an absolute HP value to `[0, max]` and persist it on the actor.
     * The drawer re-renders so the field reflects the clamped value.
     * @param {number} n  Desired HP value (already non-negative integer).
     */
    async #applyHealth(n) {
        const actor = this.actor;
        const max = Number(actor.system?.resources?.health?.max ?? 0);
        const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
        // If no max is configured (0), allow any non-negative value so the
        // field stays usable; otherwise clamp.
        const clamped = finiteMax > 0 ? Math.min(finiteMax, n) : n;
        await actor.update({ "system.resources.health.value": clamped });
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
        if (path === "system.resources.actionPoints.value") {
            const max = Number(actor.system?.resources?.actionPoints?.max ?? 0);
            const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
            const v = Math.min(finiteMax, n);
            await actor.update({ [path]: v });
        } else if (path.includes("customActionPoints") && path.endsWith(".value")) {
            await actor.update({ [path]: n });
        }
        await this.render();
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

        if (kind === "base") {
            const ap = actor.system?.resources?.actionPoints ?? {};
            const max = Number(ap.max ?? 0);
            const cur = Number(ap.value ?? 0);
            const finiteMax = Number.isFinite(max) ? Math.max(0, max) : 0;
            const v = Math.max(0, Math.min(finiteMax, cur - 1));
            await actor.update({ "system.resources.actionPoints.value": v });
        } else if (kind === "custom" && id) {
            const cur = Number(actor.system?.resources?.customActionPoints?.[id]?.value ?? 0);
            const next = Math.max(0, cur - 1);
            await actor.update({ [`system.resources.customActionPoints.${id}.value`]: next });
        }
        await self.render();
    }

    /**
     * Add or subtract the value entered in the adjacent delta input from the
     * actor's current HP, clamped to the configured Max HP.
     * @this {FarkPGApDrawer}
     */
    static async #onAdjustHealth(event, target) {
        event.preventDefault();
        /** @type {FarkPGApDrawer} */
        const self = this;
        const actor = self.actor;
        if (!actor.canUserModify(game.user, "update")) return;

        const dir = Number(target.dataset.direction ?? 0);
        if (!Number.isFinite(dir) || dir === 0) return;

        const deltaInput = self.element?.querySelector?.(".farkpg-drawer-health-delta");
        const rawDelta = Math.floor(Number(deltaInput?.value ?? 1));
        const delta = Number.isFinite(rawDelta) ? Math.max(1, rawDelta) : 1;

        const cur = Math.floor(Number(actor.system?.resources?.health?.value ?? 0)) || 0;
        const next = cur + dir * delta;
        await self.#applyHealth(Math.max(0, next));
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
