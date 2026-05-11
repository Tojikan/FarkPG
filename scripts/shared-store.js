import { socketEvent } from "./constants.js";
import {
    applySocketMessage,
    createInitialSharedState,
    sortAllBoardsInState,
} from "./state.js";

/** @type {ReturnType<typeof createInitialSharedState>} */
let sharedState = createInitialSharedState();

/** @type {{ render?: (force?: boolean) => unknown } | null} */
let appInstance = null;

export function getSharedState() {
    return sharedState;
}

export function setSharedState(next) {
    sharedState = next;
}

export function registerVirtualTableApp(app) {
    appInstance = app;
}

export function unregisterVirtualTableApp(app) {
    if (appInstance === app) appInstance = null;
}

export function emitSocket(msg) {
    game.socket.emit(socketEvent(), msg);
}

/**
 * Apply mutation locally then broadcast. Required because Foundry does not deliver
 * `game.socket.emit` events back to the emitting client, so solo players would never update.
 * Random outcomes must already be embedded in `msg.payload` (dice / updates arrays).
 */
export function commitMutation(msg) {
    const applied = applySocketMessage(sharedState, msg);
    if (!applied) return false;
    sharedState = applied;
    emitSocket(msg);
    appInstance?.render?.(true);
    return true;
}

/**
 * Handle incoming socket data from Foundry.
 * @param {object} data
 */
export function handleIncomingSocket(data) {
    if (!data?.type) return;

    if (data.type === "syncFullState") {
        const actor = game.users.get(data.actorUserId);
        if (!actor?.isGM || !data.state) return;
        sharedState = foundry.utils.duplicate(data.state);
        sortAllBoardsInState(sharedState);
        appInstance?.render?.(true);
        return;
    }

    if (data.type === "requestFullSync") {
        if (game.user.isGM) {
            emitSocket({
                type: "syncFullState",
                state: sharedState,
                actorUserId: game.user.id,
            });
        }
        return;
    }

    const applied = applySocketMessage(sharedState, data);
    if (applied) {
        sharedState = applied;
        if (data.type === "rerollDieIds" && Array.isArray(data.payload?.updates)) {
            const ids = data.payload.updates.map((u) => String(u.id));
            appInstance?.queueRollAnimation?.(data.targetBoardId, ids);
        } else if (data.type === "rollNew" && Array.isArray(data.payload?.dice)) {
            const ids = data.payload.dice.map((d) => String(d.id));
            appInstance?.queueRollAnimation?.(data.targetBoardId, ids);
        }
        appInstance?.render?.(true);
    }
}
