import {
    GM_PRIVATE_BOARD_ID,
    MODULE_ID,
    OVERVIEW_TAB_ID,
    SCENE_CONTROL_NAME,
    SHARED_BOARD_ID,
    socketEvent,
} from "./constants.js";
import { canViewBoard } from "./permissions.js";
import { handleIncomingSocket } from "./shared-store.js";
import { VirtualTableApp } from "./virtual-table-app.js";

/** @type {VirtualTableApp | undefined} */
let globalVirtualTable;

/**
 * @param {string} targetTabId
 * @param {string} requestedRaw
 */
function defaultChatLabelForBoard(targetTabId, requestedRaw) {
    if (targetTabId === OVERVIEW_TAB_ID && requestedRaw === GM_PRIVATE_BOARD_ID) {
        return game.i18n.localize(`${MODULE_ID}.chatOpenGmPrivateAsOverview`);
    }
    if (targetTabId === OVERVIEW_TAB_ID) {
        return game.i18n.localize(`${MODULE_ID}.overviewTab`);
    }
    if (targetTabId === SHARED_BOARD_ID) {
        return game.i18n.localize(`${MODULE_ID}.chatOpenSharedBoard`);
    }
    if (targetTabId === game.user.id) {
        return game.i18n.localize(`${MODULE_ID}.chatOpenMyBoard`);
    }
    const u = game.users.get(targetTabId);
    return game.i18n.format(`${MODULE_ID}.chatOpenUserBoard`, { name: u?.name ?? targetTabId });
}

/** @param {MouseEvent} ev */
function onVdtChatOpenBoardClick(ev) {
    const btn = ev.target?.closest?.("button.vdt-chat-open-board");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = btn.dataset.boardId;
    if (!id) return;
    void openVirtualTable({ boardId: id });
}

/**
 * Open or bring the Virtual Dice Table window to the front.
 * Optional `boardId`: tab to show (`__gm_private__` opens **Overview** per module rules).
 * Awaitable; safe before `ready` (waits for `ready`).
 *
 * @param {{ boardId?: string }} [options]
 * @returns {Promise<void>}
 */
async function openVirtualTable(options = {}) {
    if (!globalThis.game?.ready) {
        await new Promise((resolve) => Hooks.once("ready", () => resolve()));
    }
    const boardId = options?.boardId != null ? String(options.boardId).trim() : "";
    if (!globalVirtualTable) {
        /** @type {{ initialBoardId?: string }} */
        let ctorOpts = {};
        if (boardId) {
            const isGm = !!game.user.isGM;
            if (boardId === GM_PRIVATE_BOARD_ID || canViewBoard(boardId, isGm)) {
                ctorOpts = { initialBoardId: boardId };
            } else {
                ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.apiInvalidBoard`));
            }
        }
        globalVirtualTable = new VirtualTableApp(ctorOpts);
    } else if (boardId) {
        globalVirtualTable.navigateToBoard(boardId);
    }
    await globalVirtualTable.render(true);
}

/**
 * Post a chat message with a button that opens the dice table on a tab.
 * GM private id posts a button that opens **Overview**.
 *
 * @param {{ boardId: string; label?: string }} opts
 * @returns {Promise<void>}
 */
async function postOpenBoardChatButton(opts) {
    const requested = String(opts?.boardId ?? "").trim();
    if (!requested) return;
    const isGm = !!game.user.isGM;
    if (requested !== GM_PRIVATE_BOARD_ID && !canViewBoard(requested, isGm)) {
        ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.apiInvalidBoard`));
        return;
    }
    const targetTabId = requested === GM_PRIVATE_BOARD_ID ? OVERVIEW_TAB_ID : requested;
    const btnLabel = opts?.label ?? defaultChatLabelForBoard(targetTabId, requested);
    const esc = (s) => foundry.utils.escapeHTML(String(s));
    const content = `<div class="vdt-chat-opener"><button type="button" class="vdt-chat-open-board" data-board-id="${esc(targetTabId)}">${esc(btnLabel)}</button></div>`;
    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ user: game.user }),
        content,
    });
}

/**
 * Open the table (if needed), start a roll on the caller's own board, then
 * immediately roll `count` dice of `faces` sides. Awaitable.
 *
 * Example:
 *   await game.modules.get("virtual-dice-table").api.openStartRollAndRoll({ count: 5, faces: 8 });
 *
 * @param {{ count?: number; faces?: number }} [payload]
 * @returns {Promise<void>}
 */
async function openStartRollAndRoll(payload = {}) {
    await openVirtualTable();
    if (!globalVirtualTable) return;
    await globalVirtualTable.apiStartRollAndRoll(payload);
}

Hooks.once("init", async () => {
    game.settings.register(MODULE_ID, "maxDice", {
        name: "Maximum dice per roll",
        hint: "Caps how many dice the Roll button allows on each board (world).",
        scope: "world",
        config: true,
        type: Number,
        default: 50,
        range: { min: 1, max: 100, step: 1 },
    });

    Handlebars.registerHelper("eq", function (a, b) {
        return a === b;
    });
    /** Module JSON keys lack the package prefix Foundry's app `localize` expects */
    Handlebars.registerHelper("vdtL10n", function (key) {
        return game.i18n.localize(`${MODULE_ID}.${key}`);
    });
    /** Sharp vector d6 pips (viewBox 100×100); dot radius identical on every face */
    Handlebars.registerHelper("d6FaceSvg", function (value) {
        const v = Math.min(6, Math.max(1, Math.floor(Number(value)) || 1));
        const r = 11;
        /** @type {Record<number, [number, number][]>} */
        const faces = {
            1: [[50, 50]],
            2: [
                [28, 28],
                [72, 72],
            ],
            3: [
                [28, 28],
                [50, 50],
                [72, 72],
            ],
            4: [
                [28, 28],
                [72, 28],
                [28, 72],
                [72, 72],
            ],
            5: [
                [28, 28],
                [72, 28],
                [50, 50],
                [28, 72],
                [72, 72],
            ],
            6: [
                [28, 24],
                [72, 24],
                [28, 50],
                [72, 50],
                [28, 76],
                [72, 76],
            ],
        };
        const pts = faces[v];
        const circles = pts
            .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/>`)
            .join("");
        const svg = `<span class="vdt-d6-face" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" focusable="false">${circles}</svg></span>`;
        return new Handlebars.SafeString(svg);
    });

    await foundry.applications.handlebars.loadTemplates([
        "modules/virtual-dice-table/templates/virtual-table.hbs",
    ]);
});

Hooks.once("ready", () => {
    game.socket.on(socketEvent(), handleIncomingSocket);

    const chatLog = document.querySelector("#chat-log");
    if (chatLog) {
        chatLog.addEventListener("click", onVdtChatOpenBoardClick);
    }

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        const api = {
            openVirtualTable,
            /** Short alias for macros / systems */
            open: openVirtualTable,
            /**
             * Open + start a roll + roll N dice of X sides in one call.
             * Awaitable; suitable for macros with Asynchronous = ON.
             */
            openStartRollAndRoll,
            /** Post a chat button that opens the table on a tab (GM private → Overview). */
            postOpenBoardChatButton,
        };
        mod.api = api;
        /** Same API for systems that avoid `game.modules` (e.g. bundled scripts). */
        globalThis.virtualDiceTable = api;
        Hooks.callAll("virtualDiceTableReady", api);
    }
});

Hooks.on("getSceneControlButtons", (controls) => {
    const stubTool = "vdt-stub-tool";
    controls[SCENE_CONTROL_NAME] = {
        name: SCENE_CONTROL_NAME,
        title: game.i18n.localize(`${MODULE_ID}.sceneTitle`),
        icon: "fa-solid fa-dice",
        order: 98,
        tools: {
            [stubTool]: {
                icon: "fas fa-times",
                name: stubTool,
                order: 1,
                title: "",
            },
        },
        activeTool: stubTool,
    };
});

Hooks.on("renderSceneControls", (app, html) => {
    const btn = html.querySelector(`button[data-control="${SCENE_CONTROL_NAME}"]`);
    if (!btn) return;

    btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void openVirtualTable();
    });
});
