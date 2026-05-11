import { GM_PRIVATE_BOARD_ID } from "./constants.js";

/**
 * @param {string} boardId
 * @param {boolean} viewerIsGm
 */
export function canViewBoard(boardId, viewerIsGm) {
    if (boardId === GM_PRIVATE_BOARD_ID) return viewerIsGm;
    return true;
}

/**
 * @param {string} actorId
 * @param {string} boardId
 * @param {boolean} actorIsGm
 */
export function canMutateBoard(actorId, boardId, actorIsGm) {
    if (boardId === GM_PRIVATE_BOARD_ID) return actorIsGm;
    return actorId === boardId || actorIsGm;
}
