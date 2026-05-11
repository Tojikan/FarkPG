/**
 * Use Foundry's Roll pipeline so dice honor gameRNG / hooks / system dice config where applicable.
 */

/**
 * @param {Roll} roll
 * @returns {number[]}
 */
function extractIndividualDieResults(roll) {
    /** @type {number[]} */
    const values = [];

    const dice = roll.dice;
    if (Array.isArray(dice) && dice.length) {
        for (const die of dice) {
            for (const r of die.results ?? []) {
                if (r.discarded) continue;
                if (r.active === false) continue;
                values.push(Number(r.result));
            }
        }
        return values;
    }

    for (const term of roll.terms ?? []) {
        if (!term?.results) continue;
        for (const r of term.results) {
            if (r.discarded) continue;
            if (r.active === false) continue;
            values.push(Number(r.result));
        }
    }
    return values;
}

/**
 * Evaluate NdX and return one value per physical die (same order as `XdY`).
 * Uses `Roll#evaluate()` (async); `evaluateSync` fails when systems add non-deterministic terms.
 * @param {number} count
 * @param {number} faces
 * @returns {Promise<number[]>}
 */
export async function evaluateNdX(count, faces) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const f = Math.max(1, Math.floor(Number(faces) || 6));
    if (n === 0) return [];

    const formula = `${n}d${f}`;
    const roll = new Roll(formula);
    await roll.evaluate();
    return extractIndividualDieResults(roll).slice(0, n);
}
