/**
 * Item damage gambling: spend ammo, durability, or quantity to scale roll multiplier.
 */

/** @param {object} sys Item system data */
export function getWeaponSpendResource(sys) {
    const style = String(sys?.weaponStyle ?? "melee");
    if (sys?.ammo?.enabled === true && (style === "ranged" || style === "thrown")) {
        return "ammo";
    }
    if (sys?.durabilityEnabled === true) return "durability";
    if (sys?.ammo?.enabled === true) return "ammo";
    return null;
}

/**
 * @param {Item|string} itemOrType
 * @param {object} [sys]
 * @returns {"ammo"|"durability"|"quantity"|null}
 */
export function getItemSpendResource(itemOrType, sys) {
    const type = typeof itemOrType === "string" ? itemOrType : itemOrType?.type;
    const data = sys ?? (typeof itemOrType === "object" ? itemOrType?.system : null) ?? {};
    if (type === "weapon") return getWeaponSpendResource(data);
    if (type === "consumable" && data.rollable?.enabled === true) return "quantity";
    if (type === "equipment" && data.rollable?.enabled === true && data.durabilityEnabled === true) {
        return "durability";
    }
    return null;
}

/** @param {object} sys @param {"ammo"|"durability"|"quantity"|null} resource */
export function getItemResourcePool(sys, resource) {
    if (resource === "ammo") {
        return {
            value: Number(sys?.ammo?.value ?? 0),
            max: Number(sys?.ammo?.max ?? 0),
        };
    }
    if (resource === "durability") {
        return {
            value: Number(sys?.durability?.value ?? 0),
            max: Number(sys?.durability?.max ?? 0),
        };
    }
    if (resource === "quantity") {
        return {
            value: Number(sys?.quantity?.value ?? 0),
            max: Number(sys?.quantity?.max ?? 0),
        };
    }
    return { value: 0, max: 0 };
}

/** @deprecated Use getItemResourcePool */
export function getWeaponResourcePool(sys, resource) {
    return getItemResourcePool(sys, resource);
}

/** @param {object} sys */
export function getItemDamageFields(sys) {
    return {
        base: Number(sys?.damage?.base ?? sys?.rollable?.multiplier ?? 0),
        additional: Number(sys?.damage?.additional ?? 0),
    };
}

/**
 * @param {number} base
 * @param {number} additional
 * @param {number} spent Units committed (≥ 1 when gambling).
 */
export function computeDamageMultiplier(base, additional, spent) {
    const b = Number(base) || 0;
    const a = Number(additional) || 0;
    const s = Math.max(0, Number(spent) || 0);
    if (s <= 0) return 0;
    return b + a * Math.max(0, s - 1);
}

/** @param {number} n */
export function formatMultiplierPart(n) {
    const num = Number(n) || 0;
    if (Number.isInteger(num)) return String(num);
    return String(parseFloat(num.toFixed(2)));
}

/** Plain numeric multiplier (no suffix) for result calculations. */
export function formatMultiplierPlain(mult) {
    const n = Number(mult) || 0;
    if (n <= 0) return "—";
    return formatMultiplierPart(n);
}

/**
 * Card / hint label, e.g. "1.5 + 0.4X" or "2X" when no additional damage.
 * @param {number} base
 * @param {number} additional
 */
export function formatDamageLabel(base, additional) {
    const b = Number(base) || 0;
    const a = Number(additional) || 0;
    if (b <= 0 && a <= 0) return "—";
    if (a <= 0) return `${formatMultiplierPart(b)}X`;
    return `${formatMultiplierPart(b)} + ${formatMultiplierPart(a)}X`;
}

/** @param {number} mult */
export function formatTotalMultiplierLabel(mult) {
    const n = Number(mult) || 0;
    if (n <= 0) return "—";
    return `${formatMultiplierPart(n)}×`;
}
