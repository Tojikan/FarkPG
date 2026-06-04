import { DEFAULT_FACES, GM_PRIVATE_BOARD_ID, MODULE_ID, SHARED_BOARD_ID } from "./constants.js";
import { canMutateBoard } from "./permissions.js";

/** @returns {{ faces: number; tableDice: object[]; zoneRows: { id: string; dice: object[] }[]; rollInProgress: boolean; freeRolls: number }} */
export function emptyBoard() {
    return {
        faces: DEFAULT_FACES,
        tableDice: [],
        zoneRows: [],
        rollInProgress: false,
        freeRolls: 0,
    };
}

/** @returns {object} */
export function createInitialSharedState() {
    return {
        version: 2,
        playerBoards: {},
        gmPrivateBoard: emptyBoard(),
        sharedBoard: emptyBoard(),
    };
}

/** Migrate legacy flat zoneDice into grouped rows (one-time per board object). */
export function migrateBoard(board) {
    if (!board) return;
    if (!Array.isArray(board.zoneRows)) board.zoneRows = [];
    if (Array.isArray(board.zoneDice) && board.zoneDice.length) {
        board.zoneRows.push({
            id: foundry.utils.randomID(),
            dice: board.zoneDice.map((d) => ({ ...d })),
        });
    }
    delete board.zoneDice;
    if (typeof board.rollInProgress !== "boolean") board.rollInProgress = false;
    if (typeof board.freeRolls !== "number" || !Number.isFinite(board.freeRolls)) {
        board.freeRolls = 0;
    } else if (board.freeRolls < 0) {
        board.freeRolls = 0;
    }
}

/**
 * @param {object} state
 * @param {string} boardId
 */
export function ensureBoard(state, boardId) {
    if (boardId === GM_PRIVATE_BOARD_ID) {
        migrateBoard(state.gmPrivateBoard);
        return state.gmPrivateBoard;
    }
    if (boardId === SHARED_BOARD_ID) {
        if (!state.sharedBoard) state.sharedBoard = emptyBoard();
        migrateBoard(state.sharedBoard);
        return state.sharedBoard;
    }
    if (!state.playerBoards[boardId]) {
        state.playerBoards[boardId] = emptyBoard();
    }
    migrateBoard(state.playerBoards[boardId]);
    return state.playerBoards[boardId];
}

/** Read-only view for UI; migrates legacy structures in place once. */
export function readBoard(state, boardId) {
    let board;
    if (boardId === GM_PRIVATE_BOARD_ID) board = state.gmPrivateBoard;
    else if (boardId === SHARED_BOARD_ID) board = state.sharedBoard ?? emptyBoard();
    else board = state.playerBoards[boardId] ?? emptyBoard();
    migrateBoard(board);
    return board;
}

/**
 * @param {number} faces
 */
export function randomFace(faces) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] % faces) + 1;
}

/**
 * @param {string} boardId
 * @param {number} faces
 */
export function createDie(boardId, faces) {
    return {
        id: `${boardId}-${foundry.utils.randomID()}`,
        value: randomFace(faces),
    };
}

/** Sort dice lowest → highest within table and within each score row. */
export function sortBoardDice(board) {
    migrateBoard(board);
    if (!board?.tableDice || !board.zoneRows) return;
    const cmp = (a, b) => {
        const dv = Number(a.value) - Number(b.value);
        if (dv !== 0) return dv;
        return String(a.id).localeCompare(String(b.id));
    };
    board.tableDice.sort(cmp);
    for (const row of board.zoneRows) {
        row.dice.sort(cmp);
    }
}

/** Normalize order after GM sync or migrations. */
export function sortAllBoardsInState(state) {
    if (!state?.gmPrivateBoard || !state.playerBoards) return;
    migrateBoard(state.gmPrivateBoard);
    sortBoardDice(state.gmPrivateBoard);
    if (state.sharedBoard) {
        migrateBoard(state.sharedBoard);
        sortBoardDice(state.sharedBoard);
    }
    for (const b of Object.values(state.playerBoards)) {
        migrateBoard(b);
        sortBoardDice(b);
    }
}

/**
 * @param {object} board
 * @param {Iterable<string>} ids
 * @returns {object[]}
 */
function collectAndRemoveDice(board, ids) {
    migrateBoard(board);
    const idSet = new Set(ids);
    const moving = [];
    board.tableDice = board.tableDice.filter((d) => {
        if (idSet.has(d.id)) {
            moving.push(d);
            return false;
        }
        return true;
    });
    for (const row of board.zoneRows) {
        row.dice = row.dice.filter((d) => {
            if (idSet.has(d.id)) {
                moving.push(d);
                return false;
            }
            return true;
        });
    }
    board.zoneRows = board.zoneRows.filter((row) => row.dice.length > 0);
    return moving;
}

/**
 * Apply mutation after permission check. Returns new state or null if rejected.
 */
export function applySocketMessage(state, msg) {
    const actor = game.users.get(msg.actorUserId);
    if (!actor) return null;
    const actorIsGm = !!actor.isGM;
    if (!canMutateBoard(msg.actorUserId, msg.targetBoardId, actorIsGm)) return null;

    const next = foundry.utils.duplicate(state);

    switch (msg.type) {
        case "startRoll": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (board.rollInProgress) return null;
            board.rollInProgress = true;
            // Ensure the die face selector updates immediately on `startRoll`,
            // so a system opening the roll programmatically doesn't briefly
            // show the default d6.
            const payload = msg.payload ?? {};
            const requestedFaces = Number(payload.faces);
            const legalFaces = [4, 6, 8, 10, 12, 20];
            if (legalFaces.includes(requestedFaces)) board.faces = requestedFaces;
            // Optionally seed the free-rolls pool when a system kicks off the
            // roll programmatically (e.g. FarkPG sending an attr+skill total
            // larger than the 6-dice cap).
            if (payload.freeRolls !== undefined) {
                const fr = Number(payload.freeRolls);
                board.freeRolls = Number.isFinite(fr) && fr > 0 ? Math.floor(fr) : 0;
            } else {
                board.freeRolls = 0;
            }
            return next;
        }
        case "endRoll": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            board.rollInProgress = false;
            board.tableDice = [];
            board.zoneRows = [];
            board.faces = DEFAULT_FACES;
            board.freeRolls = 0;
            return next;
        }
        case "setFreeRolls": {
            const board = ensureBoard(next, msg.targetBoardId);
            const raw = Number(msg.payload?.value);
            const value = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
            if (board.freeRolls === value) return null;
            board.freeRolls = value;
            return next;
        }
        case "rollNew": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            const payload = msg.payload ?? {};
            if (Array.isArray(payload.dice)) {
                const f = [4, 6, 8, 10, 12, 20].includes(Number(payload.faces))
                    ? Number(payload.faces)
                    : DEFAULT_FACES;
                board.faces = f;
                board.tableDice = payload.dice.map((d) => ({
                    id: String(d.id),
                    value: Number(d.value),
                }));
                sortBoardDice(board);
                return next;
            }
            const maxDice = game.settings?.get?.(MODULE_ID, "maxDice") ?? 50;
            const n = Math.max(0, Math.min(Number(payload.count) || 0, maxDice));
            const f = [4, 6, 8, 10, 12, 20].includes(Number(payload.faces))
                ? Number(payload.faces)
                : DEFAULT_FACES;
            board.faces = f;
            board.tableDice = Array.from({ length: n }, () => createDie(msg.targetBoardId, f));
            sortBoardDice(board);
            return next;
        }
        case "rerollAll": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            const updates = msg.payload?.updates;
            if (Array.isArray(updates)) {
                const map = new Map(updates.map((u) => [String(u.id), Number(u.value)]));
                for (const d of board.tableDice) {
                    if (map.has(d.id)) d.value = map.get(d.id);
                }
                sortBoardDice(board);
                return next;
            }
            const faces = board.faces || DEFAULT_FACES;
            for (const d of board.tableDice) d.value = randomFace(faces);
            sortBoardDice(board);
            return next;
        }
        case "rerollDieIds": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            const updates = msg.payload?.updates;
            // Note: `freeRolls` is intentionally NOT decremented here. The
            // free-rolls pool is only consumed by the double-click re-roll
            // gesture, which commits a separate `setFreeRolls` mutation. Bulk
            // operations like "Reroll Board" / "Reroll selected" go through
            // this reducer too and must leave the pool alone.
            if (Array.isArray(updates)) {
                const map = new Map(updates.map((u) => [String(u.id), Number(u.value)]));
                for (const d of board.tableDice) {
                    if (map.has(d.id)) d.value = map.get(d.id);
                }
                for (const row of board.zoneRows) {
                    for (const d of row.dice) {
                        if (map.has(d.id)) d.value = map.get(d.id);
                    }
                }
                return next;
            }
            const ids = new Set(msg.payload?.ids ?? []);
            const faces = board.faces || DEFAULT_FACES;
            for (const d of board.tableDice) {
                if (ids.has(d.id)) d.value = randomFace(faces);
            }
            for (const row of board.zoneRows) {
                for (const d of row.dice) {
                    if (ids.has(d.id)) d.value = randomFace(faces);
                }
            }
            return next;
        }
        case "moveDice": {
            const ids = msg.payload?.ids ?? [];
            const to = msg.payload?.to;
            if (to !== "table" && to !== "zone") return null;
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            const moving = collectAndRemoveDice(board, ids);
            if (!moving.length) return null;

            if (to === "table") {
                board.tableDice.push(...moving);
            } else {
                const zoneNewRow = !!msg.payload?.zoneNewRow;
                const zoneRowId = msg.payload?.zoneRowId ? String(msg.payload.zoneRowId) : "";
                if (!zoneNewRow && zoneRowId) {
                    const row = board.zoneRows.find((r) => r.id === zoneRowId);
                    if (row) row.dice.push(...moving);
                    else
                        // Keep sender's row id so out-of-order socket applies stay
                        // convergent (avoids one die per row on other clients).
                        board.zoneRows.push({
                            id: zoneRowId,
                            dice: [...moving],
                        });
                } else {
                    // `newZoneRowId` must come from the mutator's payload so every
                    // client creates the same row id (randomID() here would fork per peer).
                    const nid = msg.payload?.newZoneRowId ? String(msg.payload.newZoneRowId).trim() : "";
                    board.zoneRows.push({
                        id: nid || foundry.utils.randomID(),
                        dice: [...moving],
                    });
                }
            }
            sortBoardDice(board);
            return next;
        }
        case "resetScore": {
            const board = ensureBoard(next, msg.targetBoardId);
            if (!board.rollInProgress) return null;
            board.zoneRows = [];
            return next;
        }
        default:
            return null;
    }
}
