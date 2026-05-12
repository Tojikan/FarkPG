/**
 * Import character JSON exported from the FarkPG web ZnZ builder (clipboard export).
 * Validates format, sanitizes strings, maps fields onto the Foundry actor template.
 */

import { ATTRIBUTE_KEYS, ATTRIBUTE_SKILLS } from "./config.mjs";

const EXPORT_FORMAT_ID = "farkpg-znz-character-export";
const EXPORT_FORMAT_VERSION = 1;

/** @type {readonly string[]} */
const ALL_CORE_SKILL_KEYS = ATTRIBUTE_KEYS.flatMap((k) => ATTRIBUTE_SKILLS[k]);

/** Mirrors `web/src/lib/data/znz/definitions.ts` — keep ids aligned with web export. */
const ZNZ_STARTING_ABILITIES = [
    {
        id: "snipe",
        label: "Snipe",
        costText: "Cost 2 actions",
        description: "Your next ranged attack deals 2× damage.",
    },
    {
        id: "shieldBash",
        label: "Shield Bash",
        costText: "Cost 3 AP",
        description: "Your next block roll deals half the block value as damage.",
    },
    {
        id: "rampage",
        label: "Rampage",
        costText: "Cost 4 AP",
        description: "Your next melee attack deals 3× damage.",
    },
    {
        id: "maximumEffort",
        label: "Maximum Effort",
        costText: "Cost 4 AP",
        description:
            "Declare a number 1–6. Your next Farkroll scores +50 points on that number. Applies to individual rolls only.",
    },
    {
        id: "lockedAndLoaded",
        label: "Locked and Loaded",
        costText: "Passive",
        description: "Start with a handgun and 20 ammo.",
    },
    {
        id: "bushwhack",
        label: "Bushwhack",
        costText: "Passive",
        description: "Start with a melee weapon of your choice.",
    },
    {
        id: "gearedUp",
        label: "Geared Up",
        costText: "Passive",
        description: "Start with a backpack and basic travel kit.",
    },
    {
        id: "martialArtist",
        label: "Martial Artist",
        costText: "Passive",
        description: "Your unarmed attacks deal 1× damage instead of 0.5×.",
    },
    {
        id: "stocked",
        label: "Stocked",
        costText: "Passive",
        description: "Start with additional food and water.",
    },
];

/** @type {Map<string, (typeof ZNZ_STARTING_ABILITIES)[number]>} */
const ABILITY_BY_ID = new Map(ZNZ_STARTING_ABILITIES.map((a) => [a.id, a]));

/**
 * @param {unknown} n
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampInt(n, min, max, fallback = min) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

/**
 * @param {unknown} s
 * @param {number} maxLen
 */
function sanitizeSingleLine(s, maxLen) {
    let t = String(s ?? "");
    t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    t = t.replace(/\s+/g, " ").trim();
    if (t.length > maxLen) t = t.slice(0, maxLen).trim();
    return t;
}

/**
 * @param {unknown} s
 * @param {number} maxLen
 */
function sanitizeMultiline(s, maxLen) {
    let t = String(s ?? "");
    t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    t = t.replace(/<script[\s\S]*?<\/script>/gi, "");
    t = t.replace(/<style[\s\S]*?<\/style>/gi, "");
    if (t.length > maxLen) t = t.slice(0, maxLen);
    return t;
}

/**
 * @param {unknown} id
 */
function safeCustomSkillId(id) {
    const s = String(id ?? "").trim();
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(s)) return s;
    return foundry.utils.randomID();
}

/**
 * @param {string} text
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function parseCharacterExportJson(text) {
    let raw;
    try {
        raw = JSON.parse(String(text ?? ""));
    } catch {
        return { ok: false, error: game.i18n.localize("FARKPG.Import.errJson") };
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, error: game.i18n.localize("FARKPG.Import.errNotObject") };
    }
    if (raw.formatId !== EXPORT_FORMAT_ID) {
        return { ok: false, error: game.i18n.localize("FARKPG.Import.errFormat") };
    }
    const ver = Number(raw.formatVersion);
    if (!Number.isFinite(ver) || ver < 1 || ver > EXPORT_FORMAT_VERSION) {
        return { ok: false, error: game.i18n.localize("FARKPG.Import.errVersion") };
    }
    if (raw.systemId != null && raw.systemId !== "farkpg-znz") {
        return { ok: false, error: game.i18n.localize("FARKPG.Import.errSystemId") };
    }

    const name = sanitizeSingleLine(raw.name, 256) || game.i18n.localize("FARKPG.Import.unnamed");
    const biographyPlain = sanitizeMultiline(raw.biography, 50000);

    const attrsIn = raw.attributes && typeof raw.attributes === "object" ? raw.attributes : {};
    const attributes = {
        body: clampInt(attrsIn.body, 1, 6, 3),
        adroit: clampInt(attrsIn.adroit, 1, 6, 3),
        mind: clampInt(attrsIn.mind, 1, 6, 3),
    };

    /** @type {Record<string, number>} */
    const skills = {};
    const skillsIn = raw.skills && typeof raw.skills === "object" ? raw.skills : {};
    for (const key of ALL_CORE_SKILL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(skillsIn, key)) {
            skills[key] = clampInt(skillsIn[key], 0, 4, 0);
        } else {
            skills[key] = 0;
        }
    }

    /** @type {Record<string, { id: string; name: string; attribute: string; value: number }>} */
    const customSkills = {};

    let idx = 0;
    const addonList = Array.isArray(raw.addonSkills) ? raw.addonSkills : [];
    for (const row of addonList) {
        if (!row || typeof row !== "object") continue;
        const attr = String(row.attribute ?? "");
        if (!ATTRIBUTE_KEYS.includes(/** @type {any} */ (attr))) continue;
        const label =
            sanitizeSingleLine(row.label, 120) ||
            game.i18n.format("FARKPG.Import.addonFallback", { n: idx + 1 });
        const id = foundry.utils.randomID();
        customSkills[id] = {
            id,
            name: label,
            attribute: attr,
            value: clampInt(row.rank, 0, 4, 0),
        };
        idx += 1;
    }

    const customList = Array.isArray(raw.customSkills) ? raw.customSkills : [];
    for (const row of customList) {
        if (!row || typeof row !== "object") continue;
        const attr = String(row.attribute ?? "");
        if (!ATTRIBUTE_KEYS.includes(/** @type {any} */ (attr))) continue;
        let id = safeCustomSkillId(row.id);
        while (customSkills[id]) id = foundry.utils.randomID();
        const label = sanitizeSingleLine(row.label, 120) || game.i18n.localize("FARKPG.Skills.customDefault");
        customSkills[id] = {
            id,
            name: label,
            attribute: attr,
            value: clampInt(row.rank, 0, 4, 0),
        };
    }

    const resIn = raw.resources && typeof raw.resources === "object" ? raw.resources : {};
    const hp = resIn.health && typeof resIn.health === "object" ? resIn.health : {};
    const ap = resIn.actionPoints && typeof resIn.actionPoints === "object" ? resIn.actionPoints : {};
    const hMax = clampInt(hp.max, 0, 99999999, 0);
    const hVal = clampInt(hp.value, 0, 99999999, 0);
    const apMax = clampInt(ap.max, 0, 99999, 0);
    const apVal = clampInt(ap.value, 0, 99999, 0);
    const resources = {
        health: {
            max: hMax,
            value: Math.min(hVal, hMax || hVal),
        },
        actionPoints: {
            max: apMax,
            value: Math.min(apVal, apMax || apVal),
        },
        movement: clampInt(resIn.movement, 0, 9999, 0),
    };

    const xp = clampInt(raw.xp, 0, 99999999, 0);

    let startingAbilityId =
        raw.startingAbilityId == null || raw.startingAbilityId === ""
            ? null
            : String(raw.startingAbilityId);
    if (startingAbilityId && !ABILITY_BY_ID.has(startingAbilityId)) {
        startingAbilityId = null;
    }

    const data = {
        name,
        biographyPlain,
        attributes,
        skills,
        customSkills,
        resources,
        xp,
        startingAbilityId,
    };

    return { ok: true, data };
}

/**
 * @param {Actor} actor
 * @param {object} data Parsed + sanitized payload from {@link parseCharacterExportJson}.
 */
export async function applyCharacterImport(actor, data) {
    const esc = foundry.utils.escapeHTML ?? ((x) => String(x));
    const bioHtml = data.biographyPlain
        ? `<p>${esc(data.biographyPlain).replace(/\r\n/g, "\n").split("\n").join("</p><p>")}</p>`
        : "";

    const skillsUpdate = {};
    for (const k of ALL_CORE_SKILL_KEYS) {
        skillsUpdate[`system.skills.${k}`] = data.skills[k] ?? 0;
    }

    const flat = {
        name: data.name,
        "system.biography": bioHtml,
        "system.attributes.body": data.attributes.body,
        "system.attributes.adroit": data.attributes.adroit,
        "system.attributes.mind": data.attributes.mind,
        ...skillsUpdate,
        "system.customSkills": data.customSkills,
        "system.resources.health.value": data.resources.health.value,
        "system.resources.health.max": data.resources.health.max,
        "system.resources.actionPoints.value": data.resources.actionPoints.value,
        "system.resources.actionPoints.max": data.resources.actionPoints.max,
        "system.resources.movement": data.resources.movement,
        "system.resources.exp.value": data.xp,
    };

    await actor.update(flat);

    const abilityIds = actor.items.filter((i) => i.type === "ability").map((i) => i.id);
    if (abilityIds.length) {
        await actor.deleteEmbeddedDocuments("Item", abilityIds);
    }

    if (data.startingAbilityId) {
        const def = ABILITY_BY_ID.get(data.startingAbilityId);
        if (def) {
            const desc = `<p><strong>${esc(def.costText)}</strong></p><p>${esc(def.description)}</p>`;
            await actor.createEmbeddedDocuments("Item", [
                {
                    name: def.label,
                    type: "ability",
                    img: "icons/svg/aura.svg",
                    system: {
                        description: desc,
                        cost: String(def.costText ?? ""),
                        rank: 1,
                        maxRank: 1,
                    },
                },
            ]);
        }
    }
}

/**
 * @param {Actor} actor
 */
export async function promptCharacterImport(actor) {
    if (!actor?.canUserModify?.(game.user, "update")) {
        ui.notifications?.warn(game.i18n.localize("FARKPG.Notify.noActorUpdatePermission"));
        return;
    }

    const DialogV2 = foundry.applications.api.DialogV2;
    const esc = foundry.utils.escapeHTML ?? ((s) => String(s));
    const title = game.i18n.localize("FARKPG.Import.dialogTitle");
    const hint = esc(game.i18n.localize("FARKPG.Import.dialogHint"));
    const ph = esc(game.i18n.localize("FARKPG.Import.placeholder"));
    const lbl = esc(game.i18n.localize("FARKPG.Import.jsonLabel"));

    const content = `
        <p class="farkpg-import-hint">${hint}</p>
        <div class="form-group">
            <label for="farkpg-import-json">${lbl}</label>
            <textarea id="farkpg-import-json" name="json" rows="20" class="farkpg-import-textarea" spellcheck="false" placeholder="${ph}"></textarea>
        </div>
    `;

    const result = await DialogV2.wait({
        window: { title },
        content,
        modal: true,
        rejectClose: false,
        buttons: [
            {
                action: "cancel",
                type: "button",
                default: true,
                label: game.i18n.localize("Cancel"),
            },
            {
                action: "import",
                type: "submit",
                label: game.i18n.localize("FARKPG.Import.confirm"),
                callback: (_event, _button, dialog) => {
                    const el = dialog.element?.querySelector("#farkpg-import-json");
                    return { text: String(el?.value ?? "") };
                },
            },
        ],
    });

    if (result === false || result == null) return;

    const text =
        typeof result === "string"
            ? result
            : typeof result === "object" && result !== null && "text" in result
              ? String(result.text ?? "")
              : "";

    if (!String(text).trim()) {
        ui.notifications?.warn(game.i18n.localize("FARKPG.Import.empty"));
        return;
    }

    const parsed = parseCharacterExportJson(text);
    if (!parsed.ok) {
        ui.notifications?.error(parsed.error);
        return;
    }

    try {
        await applyCharacterImport(actor, parsed.data);
    } catch (err) {
        console.error("FarkPG | character import failed", err);
        ui.notifications?.error(
            game.i18n.format("FARKPG.Import.applyFailed", { message: err?.message ?? String(err) }),
        );
        return;
    }

    ui.notifications?.info(game.i18n.localize("FARKPG.Import.success"));
}
