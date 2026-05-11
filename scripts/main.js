import { MODULE_ID, SCENE_CONTROL_NAME, socketEvent } from "./constants.js";
import { handleIncomingSocket } from "./shared-store.js";
import { VirtualTableApp } from "./virtual-table-app.js";

/** @type {VirtualTableApp | undefined} */
let globalVirtualTable;

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

    const mod = game.modules.get(MODULE_ID);
    if (mod) {
        mod.api = {
            /** Open or focus the Virtual Dice Table window */
            openVirtualTable() {
                globalVirtualTable ??= new VirtualTableApp();
                globalVirtualTable.render(true);
            },
        };
    }
});

Hooks.on("getSceneControlButtons", (controls) => {
    const stubTool = "vdt-stub-tool";
    controls[SCENE_CONTROL_NAME] = {
        name: SCENE_CONTROL_NAME,
        title: game.i18n.localize(`${MODULE_ID}.sceneTitle`),
        icon: "fa-solid fa-table-cells",
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
        globalVirtualTable ??= new VirtualTableApp();
        globalVirtualTable.render(true);
    });
});
