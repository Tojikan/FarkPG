export const MODULE_ID = "virtual-dice-table";

/** @returns {string} */
export function socketEvent() {
    return `module.${MODULE_ID}`;
}

export const GM_PRIVATE_BOARD_ID = "__gm_private__";

/** One board everyone can edit */
export const SHARED_BOARD_ID = "__vdt_shared__";

/** Board picker tab: read-only grid of in-progress rolls */
export const OVERVIEW_TAB_ID = "__vdt_overview__";

export const DEFAULT_FACES = 6;

export const SCENE_CONTROL_NAME = "vdt-menu";
