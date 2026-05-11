import { GM_PRIVATE_BOARD_ID, OVERVIEW_TAB_ID, SHARED_BOARD_ID } from "./constants.js";

/**
 * @param {string} boardId
 * @param {boolean} viewerIsGm
 */
export function canViewBoard(boardId, viewerIsGm) {
    if (boardId === OVERVIEW_TAB_ID) return true;
    if (boardId === GM_PRIVATE_BOARD_ID) return viewerIsGm;
    if (boardId === SHARED_BOARD_ID) return true;
    return true;
}

/**
 * @param {string} actorId
 * @param {string} boardId
 * @param {boolean} actorIsGm
 */
export function canMutateBoard(actorId, boardId, actorIsGm) {
    if (boardId === OVERVIEW_TAB_ID) return false;
    if (boardId === SHARED_BOARD_ID) return !!game.users.get(actorId);
    if (boardId === GM_PRIVATE_BOARD_ID) return actorIsGm;
    return actorId === boardId || actorIsGm;
}
