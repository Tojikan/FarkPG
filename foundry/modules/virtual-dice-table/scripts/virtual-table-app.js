import {
    DEFAULT_FACES,
    GM_PRIVATE_BOARD_ID,
    MODULE_ID,
    OVERVIEW_TAB_ID,
    SHARED_BOARD_ID,
} from "./constants.js";
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
        const initBid = options?.initialBoardId;
        /** @type {string | null} First-open tab override from `api.openVirtualTable({ boardId })`. */
        this._pendingInitialBoardId =
            initBid != null && String(initBid).trim().length ? String(initBid).trim() : null;
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
        /**
         * Last "Roll" count from the toolbar or API (not tableDice.length).
         * Keeps the count field stable when dice move to score or after Reroll Board.
         * @type {number | undefined}
         */
        this._rollCountToolbarPref = undefined;
    }

    /**
     * Queue a short roll animation for dice on the viewed board (local + remote socket updates).
     * @param {string} targetBoardId
     * @param {string[]} ids
     */
    queueRollAnimation(targetBoardId, ids) {
        if (!ids?.length || targetBoardId !== (this.viewBoardId ?? "")) return;
        if (this.viewBoardId === OVERVIEW_TAB_ID) return;
        if (!this._pendingRollAnimIds) this._pendingRollAnimIds = new Set();
        for (const id of ids) this._pendingRollAnimIds.add(id);
    }

    /** @returns {string | null} */
    _targetBoardIdForMutation() {
        const id = this.viewBoardId;
        if (!id || id === OVERVIEW_TAB_ID) return null;
        return id;
    }

    /**
     * Boards with an active roll (read-only snapshot for overview).
     * @param {object} shared
     * @param {boolean} isGm
     */
    _overviewPanels(shared, isGm) {
        /** @type {object[]} */
        const panels = [];
        const users = game.users.contents
            .filter((u) => u.active)
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const u of users) {
            if (!canViewBoard(u.id, isGm)) continue;
            const b = readBoard(shared, u.id);
            if (!b.rollInProgress) continue;
            panels.push({
                boardId: u.id,
                label: u.name,
                faces: b.faces,
                sessionRollCount: Number(b.sessionRollCount ?? 0),
                tableDice: b.tableDice.map((d) => ({ ...d })),
                zoneRows: b.zoneRows.map((r) => ({
                    id: r.id,
                    dice: r.dice.map((d) => ({ ...d })),
                })),
            });
        }
        {
            const b = readBoard(shared, SHARED_BOARD_ID);
            if (b.rollInProgress) {
                panels.push({
                    boardId: SHARED_BOARD_ID,
                    label: game.i18n.localize(`${MODULE_ID}.sharedBoard`),
                    faces: b.faces,
                    sessionRollCount: Number(b.sessionRollCount ?? 0),
                    tableDice: b.tableDice.map((d) => ({ ...d })),
                    zoneRows: b.zoneRows.map((r) => ({
                        id: r.id,
                        dice: r.dice.map((d) => ({ ...d })),
                    })),
                });
            }
        }
        if (isGm) {
            const b = readBoard(shared, GM_PRIVATE_BOARD_ID);
            if (b.rollInProgress) {
                panels.push({
                    boardId: GM_PRIVATE_BOARD_ID,
                    label: game.i18n.localize(`${MODULE_ID}.gmPrivateBoard`),
                    faces: b.faces,
                    sessionRollCount: Number(b.sessionRollCount ?? 0),
                    tableDice: b.tableDice.map((d) => ({ ...d })),
                    zoneRows: b.zoneRows.map((r) => ({
                        id: r.id,
                        dice: r.dice.map((d) => ({ ...d })),
                    })),
                });
            }
        }
        return panels;
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
            const pending = this._pendingInitialBoardId;
            let chosen;
            if (pending === GM_PRIVATE_BOARD_ID) {
                chosen = OVERVIEW_TAB_ID;
            } else if (pending && canViewBoard(pending, isGm)) {
                chosen = pending;
            } else {
                chosen = isGm ? GM_PRIVATE_BOARD_ID : game.user.id;
            }
            this.viewBoardId = chosen;
            this._pendingInitialBoardId = null;
            this._viewInitialized = true;
            if (!isGm && !this._requestedFullSync) {
                this._requestedFullSync = true;
                emitSocket({ type: "requestFullSync", actorUserId: game.user.id });
            }
        }

        const users = game.users.contents
            .filter((u) => u.active)
            .sort((a, b) => a.name.localeCompare(b.name));

        const overviewTab = {
            id: OVERVIEW_TAB_ID,
            label: game.i18n.localize(`${MODULE_ID}.overviewTab`),
            isGmPrivate: false,
            isOverview: true,
            isShared: false,
            active: this.viewBoardId === OVERVIEW_TAB_ID,
        };

        const userTabs = users.map((u) => ({
            id: u.id,
            label: u.name,
            isGmPrivate: false,
            isOverview: false,
            isShared: false,
            active: this.viewBoardId === u.id,
        }));

        /** @type {object[]} */
        const boardTabs = [overviewTab, ...userTabs];
        boardTabs.push({
            id: SHARED_BOARD_ID,
            label: game.i18n.localize(`${MODULE_ID}.sharedBoard`),
            isGmPrivate: false,
            isOverview: false,
            isShared: true,
            active: this.viewBoardId === SHARED_BOARD_ID,
        });
        if (isGm) {
            boardTabs.push({
                id: GM_PRIVATE_BOARD_ID,
                label: game.i18n.localize(`${MODULE_ID}.gmPrivateBoard`),
                isGmPrivate: true,
                isOverview: false,
                isShared: false,
                active: this.viewBoardId === GM_PRIVATE_BOARD_ID,
            });
        }

        const viewId = this.viewBoardId ?? game.user.id;
        const safeViewId = canViewBoard(viewId, isGm) ? viewId : game.user.id;

        if (safeViewId === OVERVIEW_TAB_ID) {
            data.boardTabs = boardTabs;
            data.viewBoardId = OVERVIEW_TAB_ID;
            data.showOverview = true;
            data.overviewPanels = this._overviewPanels(shared, isGm);
            data.rollInProgress = false;
            data.tableDice = [];
            data.zoneRows = [];
            data.faces = DEFAULT_FACES;
            data.canMutate = false;
            data.spectatorHint = false;
            data.isGm = isGm;
            data.selectedCount = 0;
            data.maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
            data.rollCountInput = 6;
            data.freeRolls = 0;
            data.showRerollSelected = false;
            data.canRerollAllRolling = false;
            return data;
        }

        const board = readBoard(shared, safeViewId);
        const selectedArr = [...this.selectedDieIds];
        const rollInProgress = !!board.rollInProgress;

        data.boardTabs = boardTabs;
        data.viewBoardId = safeViewId;
        data.showOverview = false;
        data.overviewPanels = [];
        data.rollInProgress = rollInProgress;
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
        data.spectatorHint = rollInProgress && !data.canMutate;
        if (data.spectatorHint) {
            data.spectatorOwnBoardId = game.user.id;
        }
        data.isGm = isGm;
        data.selectedCount = selectedArr.length;
        data.maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
        {
            const defaultCount = Math.min(6, data.maxDice);
            const pref = this._rollCountToolbarPref;
            if (pref !== undefined && pref !== null && Number.isFinite(Number(pref))) {
                data.rollCountInput = Math.min(
                    Math.max(0, Math.floor(Number(pref))),
                    data.maxDice,
                );
            } else {
                const countFromBoard = board.tableDice?.length ?? 0;
                data.rollCountInput = countFromBoard > 0 ? countFromBoard : defaultCount;
            }
        }
        data.freeRolls = Number(board.freeRolls ?? 0);
        data.sessionRollCount = Number(board.sessionRollCount ?? 0);
        data.showRerollSelected = rollInProgress && data.canMutate && selectedArr.length > 0;
        data.showUseFreeRoll =
            rollInProgress &&
            data.canMutate &&
            selectedArr.length > 0 &&
            data.freeRolls > 0 &&
            selectedArr.length <= data.freeRolls;
        data.canRerollAllRolling = rollInProgress && data.canMutate && board.tableDice.length > 0;

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

        root.querySelector("[data-action='start-roll']")?.addEventListener(
            "click",
            () => this._onStartRoll(),
            { signal },
        );
        root.querySelectorAll("[data-action='end-roll']").forEach((btn) =>
            btn.addEventListener("click", () => this._onEndRoll(), { signal }),
        );
        root.querySelectorAll("[data-action='reset-score']").forEach((btn) =>
            btn.addEventListener("click", () => this._onResetScore(), { signal }),
        );
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
        root.querySelector("[data-action='use-free-roll']")?.addEventListener(
            "click",
            () => void this._useFreeRollSelected(),
            { signal },
        );
        root.querySelector("[data-action='vdt-return-overview']")?.addEventListener(
            "click",
            (ev) => {
                ev.preventDefault();
                this.viewBoardId = OVERVIEW_TAB_ID;
                this.selectedDieIds.clear();
                void this.render(true);
            },
            { signal },
        );
        root.querySelector("[data-action='vdt-open-own-board']")?.addEventListener(
            "click",
            (ev) => {
                ev.preventDefault();
                const raw = ev.currentTarget?.dataset?.boardId;
                const id = raw != null && String(raw).trim() ? String(raw).trim() : game.user.id;
                if (!this.navigateToBoard(id)) return;
                void this.render(true);
            },
            { signal },
        );
        root.querySelectorAll("[data-overview-open-board]").forEach((el) => {
            el.addEventListener(
                "click",
                (ev) => {
                    if (ev.target.closest("a, button, input, select, textarea")) return;
                    const id = el.dataset.overviewOpenBoard;
                    if (!id) return;
                    if (!canViewBoard(id, game.user.isGM)) return;
                    this.viewBoardId = id;
                    this.selectedDieIds.clear();
                    void this.render(true);
                },
                { signal },
            );
        });
        root.querySelector('[name="vdt-free-rolls"]')?.addEventListener(
            "change",
            (ev) => this._onFreeRollsInputChange(ev),
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
                if (!canMutateBoard(game.user.id, this._targetBoardIdForMutation() ?? "", game.user.isGM)) return;
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
                    if (!canMutateBoard(game.user.id, this._targetBoardIdForMutation() ?? "", game.user.isGM)) return;

                    const ctrl = !!(ev.ctrlKey || ev.metaKey);
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

                    applyPlainSelect();
                },
                { signal },
            );

            dieEl.addEventListener(
                "dragstart",
                (ev) => {
                    const id = dieEl.dataset.dieId ?? "";
                    const dt = ev.dataTransfer;
                    if (!dt || !id) return;
                    if (!this._targetBoardIdForMutation()) return;
                    const primaryRegion = dieEl.dataset.region ?? "";
                    const shell = dieEl.closest(".vdt-root") ?? root;
                    /** @type {string[]} */
                    let ids = [id];
                    if (this.selectedDieIds.has(id) && this.selectedDieIds.size > 1) {
                        const bid = this._targetBoardIdForMutation();
                        if (!bid) return;
                        const board = readBoard(getSharedState(), bid);
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

        /** Score row under pointer (handles drops on SVG pips / gaps where `ev.target` misses the row). */
        const findScoreRowUnderPointer = (ev) => {
            const doc = root.ownerDocument;
            if (!doc?.elementsFromPoint) return null;
            const x = ev.clientX;
            const y = ev.clientY;
            if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) {
                return null;
            }
            let stack;
            try {
                stack = doc.elementsFromPoint(x, y);
            } catch {
                return null;
            }
            for (const el of stack) {
                if (!(el instanceof Element)) continue;
                if (!root.contains(el)) continue;
                const row = el.closest?.(".vdt-zone-row[data-zone-row-id]");
                if (row instanceof HTMLElement && row.dataset.zoneRowId) return row;
            }
            return null;
        };

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
                const bid = this._targetBoardIdForMutation();
                const can = !!bid && canMutateBoard(game.user.id, bid, game.user.isGM);
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
                if (!canMutateBoard(game.user.id, this._targetBoardIdForMutation() ?? "", game.user.isGM)) return;
                const srcDie = findVdtDie(root, ids[0]);
                const actualFrom = srcDie?.dataset.region;
                if (!actualFrom) return;
                if (actualFrom === targetRegion && actualFrom !== "zone") return;
                for (const i of ids) {
                    if (findVdtDie(root, i)?.dataset.region !== actualFrom) return;
                }
                /** Prefer an explicit score row over the generic "new row" zone (same for all clients). */
                const resolveZoneDrop = () => {
                    const under = findScoreRowUnderPointer(ev);
                    if (under) return under;
                    const t = ev.target;
                    if (!(t instanceof Element)) return dropEl;
                    const onRow = t.closest?.(".vdt-zone-row[data-zone-row-id]");
                    if (onRow instanceof HTMLElement && onRow.dataset.zoneRowId) return onRow;
                    return dropEl;
                };
                if (actualFrom === "table" && targetRegion === "zone") {
                    const zEl = resolveZoneDrop();
                    const zoneRowId = zEl.dataset.zoneRowId ? String(zEl.dataset.zoneRowId) : "";
                    if (zoneRowId) {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: false, zoneRowId });
                    } else if (zEl.dataset.zoneTarget === "new" || dropEl.dataset.zoneTarget === "new") {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: true });
                    }
                } else if (actualFrom === "zone" && targetRegion === "table") {
                    this._commitMoveDice({ ids, to: "table" });
                } else if (actualFrom === "zone" && targetRegion === "zone") {
                    const zEl = resolveZoneDrop();
                    const zoneRowId = zEl.dataset.zoneRowId ? String(zEl.dataset.zoneRowId) : "";
                    if (zoneRowId) {
                        this._commitMoveDice({ ids, to: "zone", zoneNewRow: false, zoneRowId });
                    } else if (zEl.dataset.zoneTarget === "new" || dropEl.dataset.zoneTarget === "new") {
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

    /**
     * Switch the window to a tab. GM private id opens **Overview** (read-only aggregate).
     * @param {string} boardId
     * @returns {boolean}
     */
    navigateToBoard(boardId) {
        const id = String(boardId ?? "").trim();
        const isGm = !!game.user.isGM;
        if (!id) return false;
        if (id === GM_PRIVATE_BOARD_ID) {
            this.viewBoardId = OVERVIEW_TAB_ID;
            this.selectedDieIds.clear();
            return true;
        }
        if (!canViewBoard(id, isGm)) {
            ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.apiInvalidBoard`));
            return false;
        }
        this.viewBoardId = id;
        this.selectedDieIds.clear();
        return true;
    }

    _onStartRoll() {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        commitMutation({
            type: "startRoll",
            actorUserId: game.user.id,
            targetBoardId: boardId,
            payload: {},
        });
    }

    /**
     * Commit a manual edit of the free-rolls input.
     * @param {Event} ev
     */
    _onFreeRollsInputChange(ev) {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const raw = Number(ev.target?.value);
        const value = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
        commitMutation({
            type: "setFreeRolls",
            actorUserId: game.user.id,
            targetBoardId: boardId,
            payload: { value },
        });
    }

    /**
     * Spend free rolls from the active board's pool.
     * @param {number} [count=1]
     */
    _consumeFreeRolls(count = 1) {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const board = readBoard(getSharedState(), boardId);
        const current = Number(board?.freeRolls ?? 0);
        const n = Math.max(0, Math.floor(Number(count) || 0));
        if (n <= 0 || current <= 0) return;
        commitMutation({
            type: "setFreeRolls",
            actorUserId: game.user.id,
            targetBoardId: boardId,
            payload: { value: Math.max(0, current - n) },
        });
    }

    _onEndRoll() {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        if (
            commitMutation({
                type: "endRoll",
                actorUserId: game.user.id,
                targetBoardId: boardId,
                payload: {},
            })
        ) {
            this._rollCountToolbarPref = undefined;
            this.selectedDieIds.clear();
            void this.render(true);
        }
    }

    _onResetScore() {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        if (
            !commitMutation({
                type: "resetScore",
                actorUserId: game.user.id,
                targetBoardId: boardId,
                payload: {},
            })
        ) {
            return;
        }
        const b = readBoard(getSharedState(), boardId);
        const onBoard = new Set([
            ...b.tableDice.map((d) => d.id),
            ...b.zoneRows.flatMap((r) => r.dice.map((d) => d.id)),
        ]);
        for (const id of [...this.selectedDieIds]) {
            if (!onBoard.has(id)) this.selectedDieIds.delete(id);
        }
        void this.render(true);
    }

    async _onRerollAllRolling() {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const board = readBoard(getSharedState(), boardId);
        const ids = board.tableDice.map((d) => d.id);
        if (!ids.length) return;
        await this._rerollDieIdsFromIds(ids);
    }

    async _onRollNew() {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const root = this.element;
        const count = Number(root.querySelector('[name="vdt-count"]')?.value ?? 1);
        const facesRaw = Number(root.querySelector('[name="vdt-faces"]')?.value ?? 6);
        await this._rollNewOnBoard(boardId, count, facesRaw);
    }

    /**
     * Shared roll-and-commit path used by both the toolbar button and
     * `apiStartRollAndRollDice`. Clamps `count` to the world maxDice setting and
     * filters `faces` to the legal die set (defaults to `DEFAULT_FACES`).
     * @param {string} boardId
     * @param {number} count
     * @param {number} facesRaw
     */
    async _rollNewOnBoard(boardId, count, facesRaw) {
        const maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
        const n = Math.max(0, Math.min(Number(count) || 0, maxDice));
        const f = [4, 6, 8, 10, 12, 20].includes(Number(facesRaw))
            ? Number(facesRaw)
            : DEFAULT_FACES;
        if (n === 0) return;
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
            } else {
                this._rollCountToolbarPref = n;
            }
            this.selectedDieIds.clear();
        } catch (err) {
            console.error("Virtual Dice Table | Roll failed", err);
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.rollFailed`));
        }
    }

    /**
     * Start (or sync) a roll on the caller's board without rolling dice.
     * Used by macros that should only press "Start roll".
     *
     * @param {{ count?: number; faces?: number; freeRolls?: number }} payload
     */
    async apiStartRollOnly({ count, faces = DEFAULT_FACES, freeRolls = 0 } = {}) {
        const isGm = !!game.user.isGM;
        const targetId = isGm ? GM_PRIVATE_BOARD_ID : game.user.id;
        if (!canMutateBoard(game.user.id, targetId, isGm)) return;

        if (this.viewBoardId !== targetId) {
            this.viewBoardId = targetId;
            this.selectedDieIds.clear();
            await this.render(true);
        }

        const maxDice = game.settings.get(MODULE_ID, "maxDice") ?? 50;
        if (count !== undefined && count !== null) {
            const n = Math.max(0, Math.min(Math.floor(Number(count) || 0), maxDice));
            this._rollCountToolbarPref = n;
        }

        const fr = Math.max(0, Math.floor(Number(freeRolls) || 0));
        const board = readBoard(getSharedState(), targetId);
        if (!board.rollInProgress) {
            commitMutation({
                type: "startRoll",
                actorUserId: game.user.id,
                targetBoardId: targetId,
                payload: { faces, freeRolls: fr },
            });
        } else {
            commitMutation({
                type: "setFreeRolls",
                actorUserId: game.user.id,
                targetBoardId: targetId,
                payload: { value: fr },
            });
        }
    }

    /**
     * Same as {@link apiStartRollOnly} then evaluates and commits `rollNew`.
     *
     * @param {{ count?: number; faces?: number; freeRolls?: number }} payload
     */
    async apiStartRollAndRollDice({ count = 1, faces = DEFAULT_FACES, freeRolls = 0 } = {}) {
        await this.apiStartRollOnly({ count, faces, freeRolls });
        const isGm = !!game.user.isGM;
        const targetId = isGm ? GM_PRIVATE_BOARD_ID : game.user.id;
        await this._rollNewOnBoard(targetId, count, faces);
    }

    /**
     * @param {string[]} ids
     * @param {{ freeRoll?: boolean }} [opts]
     * @returns {Promise<boolean>}
     */
    async _rerollDieIdsFromIds(ids, opts = {}) {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return false;
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
                    payload: { updates, freeRoll: !!opts.freeRoll },
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
        const bid = this._targetBoardIdForMutation();
        if (!bid) return;
        const shared = getSharedState();
        const board = readBoard(shared, bid);
        const poolIds = new Set([
            ...board.tableDice.map((d) => d.id),
            ...board.zoneRows.flatMap((r) => r.dice.map((d) => d.id)),
        ]);
        const filtered = ids.filter((id) => poolIds.has(id));
        if (!filtered.length) return;
        await this._rerollDieIdsFromIds(filtered);
    }

    async _useFreeRollSelected() {
        const ids = [...this.selectedDieIds];
        if (!ids.length) return;
        const bid = this._targetBoardIdForMutation();
        if (!bid || !canMutateBoard(game.user.id, bid, game.user.isGM)) return;
        const board = readBoard(getSharedState(), bid);
        const freeRolls = Number(board.freeRolls ?? 0);
        const poolIds = new Set([
            ...board.tableDice.map((d) => d.id),
            ...board.zoneRows.flatMap((r) => r.dice.map((d) => d.id)),
        ]);
        const filtered = ids.filter((id) => poolIds.has(id));
        if (!filtered.length || freeRolls <= 0 || filtered.length > freeRolls) return;
        const ok = await this._rerollDieIdsFromIds(filtered, { freeRoll: true });
        if (ok) this._consumeFreeRolls(filtered.length);
    }

    /**
     * @param {{ ids: string[]; to: "zone"|"table"; zoneNewRow?: boolean; zoneRowId?: string; newZoneRowId?: string }} payload
     */
    _commitMoveDice(payload) {
        const boardId = this._targetBoardIdForMutation();
        if (!boardId || !canMutateBoard(game.user.id, boardId, game.user.isGM)) return;
        const pl = { ...payload };
        if (pl.to === "zone" && pl.zoneNewRow && !String(pl.newZoneRowId ?? "").trim()) {
            pl.newZoneRowId = foundry.utils.randomID();
        }
        if (pl.to === "zone") {
            for (const id of pl.ids) this.selectedDieIds.delete(id);
        }
        commitMutation({
            type: "moveDice",
            actorUserId: game.user.id,
            targetBoardId: boardId,
            payload: pl,
        });
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
