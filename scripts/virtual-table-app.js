import { DEFAULT_FACES, GM_PRIVATE_BOARD_ID, MODULE_ID } from "./constants.js";
import { evaluateNdX } from "./foundry-rolls.js";
import { canMutateBoard, canViewBoard } from "./permissions.js";
import { readBoard } from "./state.js";
import {
    commitMutation,
    emitSocket,
    getSharedState,
    registerVirtualTableApp,
    unregisterVirtualTableApp,
} from "./shared-store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Electron / some hosts strip arbitrary MIME types; `text/plain` is primary. */
const VDT_DIE_DRAG_MIME = "application/x-virtual-dice-table-die-id";
/** Multi-drag: JSON string array of die ids (same source region). */
const VDT_DIE_IDS_DRAG_MIME = "application/x-vdt-die-ids-json";

export class VirtualTableApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "virtual-dice-table-app",
        classes: ["virtual-dice-table"],
        tag: "div",
        window: {
            icon: "fa-solid fa-table-cells",
            resizable: true,
        },
        position: { width: 740, height: 820 },
    };

    get title() {
        return game.i18n.localize(`${MODULE_ID}.windowTitle`);
    }

    static PARTS = {
        main: {
            root: true,
            template: "modules/virtual-dice-table/templates/virtual-table.hbs",
        },
    };

    constructor(options = {}) {
        super(options);
        /** @type {string | null} */
        this.viewBoardId = null;
        this._viewInitialized = false;
        /** @type {Set<string>} */
        this.selectedDieIds = new Set();
        /** @type {AbortController | null} */
        this._abortController = null;
        /** @type {{ startX: number; startY: number; el: HTMLElement; surface: HTMLElement } | null} */
        this._marqueeState = null;
        /** @type {boolean} */
        this._requestedFullSync = false;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this._dieSelectDelayTimer = null;
        /** @type {Set<string> | null} Dice to animate after next render */
        this._pendingRollAnimIds = null;
    }

    /**
     * Queue a short roll animation for dice on the viewed board (local + remote socket updates).
     * @param {string} targetBoardId
     * @param {string[]} ids
     */
    queueRollAnimation(targetBoardId, ids) {
        if (!ids?.length || targetBoardId !== (this.viewBoardId ?? "")) return;
        if (!this._pendingRollAnimIds) this._pendingRollAnimIds = new Set();
        for (const id of ids) this._pendingRollAnimIds.add(id);
    }

    async close(options = {}) {
        if (this._dieSelectDelayTimer) clearTimeout(this._dieSelectDelayTimer);
        this._dieSelectDelayTimer = null;
        this._abortController?.abort();
        this._abortController = null;
        unregisterVirtualTableApp(this);
        return super.close(options);
    }

    async _prepareContext(options) {
        const data = await super._prepareContext(options);
        const shared = getSharedState();
        const isGm = !!game.user.isGM;

        if (!this._viewInitialized) {
            this.viewBoardId = isGm ? GM_PRIVATE_BOARD_ID : game.user.id;
            this._viewInitialized = true;
            if (!isGm && !this._requestedFullSync) {
                this._requestedFullSync = true;
                emitSocket({ type: "requestFullSync", actorUserId: game.user.id });
            }
        }

        const users = game.users.contents
            .filter((u) => u.active)
            .sort((a, b) => a.name.localeCompare(b.name));

        const boardTabs = users.map((u) => ({
            id: u.id,
            label: u.name,
            isGmPrivate: false,
            active: this.viewBoardId === u.id,
        }));

        if (isGm) {
            boardTabs.push({
                id: GM_PRIVATE_BOARD_ID,
                label: game.i18n.localize(`${MODULE_ID}.gmPrivateBoard`),
                isGmPrivate: true,
                active: this.viewBoardId === GM_PRIVATE_BOARD_ID,
            });
        }

        const viewId = this.viewBoardId ?? game.user.id;
        const safeViewId = canViewBoard(viewId, isGm) ? viewId : game.user.id;

        const board = readBoard(shared, safeViewId);
        const selectedArr = [...this.selectedDieIds];

        data.boardTabs = boardTabs;
        data.viewBoardId = safeViewId;
        data.tableDice = board.tableDice.map((d) => ({
            ...d,
            selected: this.selectedDieIds.has(d.id),
        }));
        data.zoneRows = board.zoneRows.map((row) => ({
            id: row.id,
            dice: row.dice.map((d) => ({
                ...d,
                selected: this.selectedDieIds.has(d.id),
            })),
        }));
        data.faces = board.faces;
        data.canMutate = canMutateBoard(game.user.id, safeViewId, isGm);
        data.spectatorHint = !data.canMutate;
        data.isGm = isGm;
        data.selectedCount = selectedArr.length;
        data.maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
        data.showRerollSelected = data.canMutate && selectedArr.length > 0;
        data.canRerollAllRolling = data.canMutate && board.tableDice.length > 0;

        return data;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        registerVirtualTableApp(this);
        if (this._dieSelectDelayTimer) clearTimeout(this._dieSelectDelayTimer);
        this._dieSelectDelayTimer = null;
        this._abortController?.abort();
        this._abortController = new AbortController();
        const { signal } = this._abortController;
        const root = this.element;

        root.querySelector("[data-action='roll-new']")?.addEventListener(
            "click",
            () => void this._onRollNew(),
            { signal },
        );
        root.querySelector("[data-action='reroll-all-rolling']")?.addEventListener(
            "click",
            () => void this._onRerollAllRolling(),
            { signal },
        );
        root.querySelector("[data-action='reroll-selected']")?.addEventListener(
            "click",
            () => void this._rerollSelected(),
            { signal },
        );
        root.querySelector("[data-action='reset-board']")?.addEventListener(
            "click",
            () => this._onResetBoard(),
            { signal },
        );

        root.querySelectorAll(".vdt-board-tab").forEach((btn) => {
            btn.addEventListener(
                "click",
                () => {
                    const id = btn.dataset.boardId;
                    if (!id) return;
                    if (!canViewBoard(id, game.user.isGM)) return;
                    this.viewBoardId = id;
                    this.selectedDieIds.clear();
                    this.render(true);
                },
                { signal },
            );
        });

        root.addEventListener(
            "contextmenu",
            (ev) => {
                if (!this.selectedDieIds.size) return;
                ev.preventDefault();
                this.selectedDieIds.clear();
                void this.render(true);
            },
            { signal },
        );

        const tableSurface = root.querySelector(".vdt-table-surface");
        const marqueeEl = root.querySelector(".vdt-marquee-band");

        tableSurface?.addEventListener(
            "pointerdown",
            (ev) => {
                if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
                if (ev.button !== 0) return;
                if (ev.target.closest?.(".vdt-die")) return;
                ev.preventDefault();
                const rect = tableSurface.getBoundingClientRect();
                this._marqueeState = {
                    startX: ev.clientX,
                    startY: ev.clientY,
                    surface: tableSurface,
                    el: marqueeEl,
                };
                marqueeEl.hidden = false;
                marqueeEl.style.left = `${ev.clientX - rect.left}px`;
                marqueeEl.style.top = `${ev.clientY - rect.top}px`;
                marqueeEl.style.width = "0";
                marqueeEl.style.height = "0";
                tableSurface.setPointerCapture(ev.pointerId);
            },
            { signal },
        );

        tableSurface?.addEventListener(
            "pointermove",
            (ev) => {
                if (!this._marqueeState || !marqueeEl) return;
                const { startX, startY, surface, el } = this._marqueeState;
                const rect = surface.getBoundingClientRect();
                const x = Math.min(startX, ev.clientX) - rect.left;
                const y = Math.min(startY, ev.clientY) - rect.top;
                const w = Math.abs(ev.clientX - startX);
                const h = Math.abs(ev.clientY - startY);
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                el.style.width = `${w}px`;
                el.style.height = `${h}px`;
            },
            { signal },
        );

        const endMarquee = (ev) => {
            if (!this._marqueeState || !marqueeEl) return;
            tableSurface?.releasePointerCapture(ev.pointerId);
            const box = marqueeEl.getBoundingClientRect();
            marqueeEl.hidden = true;
            this._marqueeState = null;
            if (box.width < 4 && box.height < 4) return;
            root.querySelectorAll('.vdt-table-surface .vdt-die[data-region="table"]').forEach((dieEl) => {
                const dr = dieEl.getBoundingClientRect();
                if (intersects(box, dr)) this.selectedDieIds.add(dieEl.dataset.dieId);
            });
            this.render(true);
        };

        tableSurface?.addEventListener("pointerup", endMarquee, { signal });
        tableSurface?.addEventListener("pointercancel", endMarquee, { signal });

        root.querySelectorAll(".vdt-die").forEach((dieEl) => {
            dieEl.addEventListener(
                "click",
                (ev) => {
                    ev.stopPropagation();
                    const id = dieEl.dataset.dieId;
                    if (!id) return;
                    if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
                    if (ev.detail > 1) return;

                    const ctrl = !!(ev.ctrlKey || ev.metaKey);
                    if (this._dieSelectDelayTimer) clearTimeout(this._dieSelectDelayTimer);

                    const applyPlainSelect = () => {
                        this.selectedDieIds.clear();
                        this.selectedDieIds.add(id);
                        void this.render(true);
                    };

                    if (ctrl) {
                        if (this.selectedDieIds.has(id)) this.selectedDieIds.delete(id);
                        else this.selectedDieIds.add(id);
                        void this.render(true);
                        return;
                    }

                    if (this.selectedDieIds.size > 1) {
                        this._dieSelectDelayTimer = setTimeout(() => {
                            this._dieSelectDelayTimer = null;
                            applyPlainSelect();
                        }, 260);
                    } else {
                        applyPlainSelect();
                    }
                },
                { signal },
            );

            dieEl.addEventListener(
                "dblclick",
                (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (this._dieSelectDelayTimer) {
                        clearTimeout(this._dieSelectDelayTimer);
                        this._dieSelectDelayTimer = null;
                    }
                    const id = dieEl.dataset.dieId;
                    if (!id) return;
                    if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
                    if (this.selectedDieIds.has(id)) void this._rerollSelected();
                    else void this._rerollDieIdsFromIds([id]);
                },
                { signal },
            );

            dieEl.addEventListener(
                "dragstart",
                (ev) => {
                    const id = dieEl.dataset.dieId ?? "";
                    const dt = ev.dataTransfer;
                    if (!dt || !id) return;
                    const primaryRegion = dieEl.dataset.region ?? "";
                    const shell = dieEl.closest(".vdt-root") ?? root;
                    /** @type {string[]} */
                    let ids = [id];
                    if (this.selectedDieIds.has(id) && this.selectedDieIds.size > 1) {
                        const board = readBoard(getSharedState(), this.viewBoardId ?? "");
                        const onBoard = new Set([
                            ...board.tableDice.map((d) => d.id),
                            ...board.zoneRows.flatMap((r) => r.dice.map((d) => d.id)),
                        ]);
                        ids = [...this.selectedDieIds].filter((i) => onBoard.has(i));
                        ids = ids.filter((i) => findVdtDie(shell, i)?.dataset.region === primaryRegion);
                        if (ids.length <= 1) ids = [id];
                    }
                    dt.setData("text/plain", ids[0]);
                    dt.setData(VDT_DIE_DRAG_MIME, ids[0]);
                    if (ids.length > 1) dt.setData(VDT_DIE_IDS_DRAG_MIME, JSON.stringify(ids));
                    dt.effectAllowed = "move";
                },
                { signal },
            );
        });

        const dragOpts = { capture: true, signal };
        /** Drops often land on child dice; resolve the nearest marked drop surface. */
        const resolveDropEl = (t) => (t instanceof Element ? t.closest(".vdt-drop-target") : null);

        root.addEventListener(
            "dragenter",
            (ev) => {
                const dropEl = resolveDropEl(ev.target);
                if (!dropEl) return;
                ev.preventDefault();
                dropEl.classList.add("vdt-drag-active");
            },
            dragOpts,
        );
        root.addEventListener(
            "dragleave",
            (ev) => {
                const dropEl = resolveDropEl(ev.target);
                if (!dropEl) return;
                const rel = ev.relatedTarget;
                if (rel instanceof Node && dropEl.contains(rel)) return;
                dropEl.classList.remove("vdt-drag-active");
            },
            dragOpts,
        );
        root.addEventListener(
            "dragover",
            (ev) => {
                const dropEl = resolveDropEl(ev.target);
                if (!dropEl) return;
                ev.preventDefault();
                ev.stopPropagation();
                const can = canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM);
                ev.dataTransfer.dropEffect = can ? "move" : "none";
            },
            dragOpts,
        );
        root.addEventListener(
            "drop",
            (ev) => {
                const dropEl = resolveDropEl(ev.target);
                if (!dropEl) return;
                ev.preventDefault();
                ev.stopPropagation();
                dropEl.classList.remove("vdt-drag-active");
                const ids = readDragDieIds(ev.dataTransfer);
                const targetRegion = dropEl.dataset.dropRegion;
                if (!ids.length || (targetRegion !== "table" && targetRegion !== "zone")) return;
                if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
                const srcDie = findVdtDie(root, ids[0]);
                const actualFrom = srcDie?.dataset.region;
                if (!actualFrom) return;
                if (actualFrom === targetRegion && actualFrom !== "zone") return;
                for (const i of ids) {
                    if (findVdtDie(root, i)?.dataset.region !== actualFrom) return;
                }
                if (actualFrom === "table" && targetRegion === "zone") {
                    const zoneRowId = dropEl.dataset.zoneRowId ? String(dropEl.dataset.zoneRowId) : "";
                    if (zoneRowId) {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: false, zoneRowId });
                    } else if (dropEl.dataset.zoneTarget === "new") {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: true });
                    }
                } else if (actualFrom === "zone" && targetRegion === "table") {
                    this._commitMoveDice({ ids, to: "table" });
                } else if (actualFrom === "zone" && targetRegion === "zone") {
                    const zoneRowId = dropEl.dataset.zoneRowId ? String(dropEl.dataset.zoneRowId) : "";
                    if (zoneRowId) {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: false, zoneRowId });
                    } else if (dropEl.dataset.zoneTarget === "new") {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: true });
                    }
                }
            },
            dragOpts,
        );

        root.ownerDocument?.addEventListener(
            "dragend",
            () => {
                root.querySelectorAll(".vdt-drag-active").forEach((el) => el.classList.remove("vdt-drag-active"));
            },
            { signal },
        );

        this._applyRollAnimation(root);
    }

    /**
     * @param {HTMLElement | undefined} root
     */
    _applyRollAnimation(root) {
        const ids = this._pendingRollAnimIds;
        if (!ids?.size || !root) return;
        this._pendingRollAnimIds = null;
        requestAnimationFrame(() => {
            const fallbackMs = 480;
            for (const id of ids) {
                const el = root.querySelector(`[data-die-id="${CSS.escape(id)}"]`);
                if (!el) continue;
                el.classList.add("vdt-die-rolling");
                let cleared = false;
                const done = () => {
                    if (cleared) return;
                    cleared = true;
                    el.classList.remove("vdt-die-rolling");
                };
                el.addEventListener("animationend", done, { once: true });
                window.setTimeout(done, fallbackMs);
            }
        });
    }

    async _onRerollAllRolling() {
        const boardId = this.viewBoardId;
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const board = readBoard(getSharedState(), boardId);
        const ids = board.tableDice.map((d) => d.id);
        if (!ids.length) return;
        await this._rerollDieIdsFromIds(ids);
    }

    async _onRollNew() {
        const boardId = this.viewBoardId;
        if (
            !boardId ||
            !canMutateBoard(game.user.id, boardId, game.user.isGM)
        ) {
            return;
        }
        const root = this.element;
        const count = Number(root.querySelector('[name="vdt-count"]')?.value ?? 1);
        const facesRaw = Number(root.querySelector('[name="vdt-faces"]')?.value ?? 6);
        const maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
        const n = Math.max(0, Math.min(Number(count) || 0, maxDice));
        const f = [4, 6, 8, 10, 12, 20].includes(facesRaw) ? facesRaw : DEFAULT_FACES;
        try {
            const values = await evaluateNdX(n, f);
            if (values.length !== n) {
                ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.rollMismatch`));
                return;
            }
            const dice = values.map((value) => ({
                id: `${boardId}-${foundry.utils.randomID()}`,
                value,
            }));
            this.queueRollAnimation(boardId, dice.map((d) => d.id));
            if (
                !commitMutation({
                    type: "rollNew",
                    actorUserId: game.user.id,
                    targetBoardId: boardId,
                    payload: { faces: f, dice },
                })
            ) {
                this._pendingRollAnimIds = null;
            }
            this.selectedDieIds.clear();
        } catch (err) {
            console.error("Virtual Dice Table | Roll failed", err);
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.rollFailed`));
        }
    }

    /**
     * @param {string[]} ids
     * @returns {Promise<boolean>}
     */
    async _rerollDieIdsFromIds(ids) {
        const boardId = this.viewBoardId;
        if (
            !boardId ||
            !canMutateBoard(game.user.id, boardId, game.user.isGM)
        ) {
            return false;
        }
        const board = readBoard(getSharedState(), boardId);
        const faces = board.faces || DEFAULT_FACES;
        const idSet = new Set(ids);
        /** @type {string[]} */
        const orderedIds = [];
        for (const d of board.tableDice) {
            if (idSet.has(d.id)) orderedIds.push(d.id);
        }
        for (const row of board.zoneRows) {
            for (const d of row.dice) {
                if (idSet.has(d.id)) orderedIds.push(d.id);
            }
        }
        if (!orderedIds.length) return false;
        try {
            const values = await evaluateNdX(orderedIds.length, faces);
            if (values.length !== orderedIds.length) {
                ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.rollMismatch`));
                return false;
            }
            const updates = orderedIds.map((id, i) => ({ id, value: values[i] }));
            this.queueRollAnimation(boardId, orderedIds);
            if (
                !commitMutation({
                    type: "rerollDieIds",
                    actorUserId: game.user.id,
                    targetBoardId: boardId,
                    payload: { updates },
                })
            ) {
                this._pendingRollAnimIds = null;
            }
            return true;
        } catch (err) {
            console.error("Virtual Dice Table | Reroll failed", err);
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.rollFailed`));
            return false;
        }
    }

    async _rerollSelected() {
        const ids = [...this.selectedDieIds];
        if (!ids.length) return;
        const shared = getSharedState();
        const board = readBoard(shared, this.viewBoardId ?? "");
        const poolIds = new Set([
            ...board.tableDice.map((d) => d.id),
            ...board.zoneRows.flatMap((r) => r.dice.map((d) => d.id)),
        ]);
        const filtered = ids.filter((id) => poolIds.has(id));
        if (!filtered.length) return;
        await this._rerollDieIdsFromIds(filtered);
    }

    /**
     * @param {{ ids: string[]; to: "zone"|"table"; zoneNewRow?: boolean; zoneRowId?: string }} payload
     */
    _commitMoveDice(payload) {
        if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
        if (payload.to === "zone") {
            for (const id of payload.ids) this.selectedDieIds.delete(id);
        }
        commitMutation({
            type: "moveDice",
            actorUserId: game.user.id,
            targetBoardId: this.viewBoardId,
            payload,
        });
    }

    _onResetBoard() {
        if (!canMutateBoard(game.user.id, this.viewBoardId ?? "", game.user.isGM)) return;
        commitMutation({
            type: "resetBoard",
            actorUserId: game.user.id,
            targetBoardId: this.viewBoardId,
            payload: { resetFaces: true },
        });
        this.selectedDieIds.clear();
    }
}

/**
 * @param {DOMRect} a
 * @param {DOMRect} b
 */
function intersects(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * @param {HTMLElement} root
 * @param {string} dieId
 */
function findVdtDie(root, dieId) {
    if (!dieId || !root) return null;
    for (const el of root.querySelectorAll(".vdt-die")) {
        if (el.dataset.dieId === dieId) return el;
    }
    return null;
}

/** @param {DataTransfer | null} dt */
function readDragDieId(dt) {
    if (!dt) return "";
    let id = dt.getData("text/plain");
    if (!id) id = dt.getData(VDT_DIE_DRAG_MIME);
    return String(id ?? "").trim();
}

/** @param {DataTransfer | null} dt @returns {string[]} */
function readDragDieIds(dt) {
    if (!dt) return [];
    const raw = dt.getData(VDT_DIE_IDS_DRAG_MIME);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const ids = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
                if (ids.length) return ids;
            }
        } catch {
            /* fall through */
        }
    }
    const one = readDragDieId(dt);
    return one ? [one] : [];
}
