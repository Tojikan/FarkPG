export const MODULE_ID = "virtual-dice-table";

/** @returns {string} */
export function socketEvent() {
    return `module.${MODULE_ID}`;
}

export const GM_PRIVATE_BOARD_ID = "__gm_private__";

export const DEFAULT_FACES = 6;

export const SCENE_CONTROL_NAME = "vdt-menu";
