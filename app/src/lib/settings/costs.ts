import type { AttributeCreationRules } from './types';

/** Cumulative cost of holding `rank` ranks, e.g. rankCosts [1,2,3] → rank 2 costs 3. */
export function rankTotalCost(rankCosts: number[], rank: number): number {
	let total = 0;
	for (let i = 0; i < rank; i++) total += rankCosts[i] ?? rankCosts[rankCosts.length - 1] ?? 1;
	return total;
}

/**
 * Points spent on a full attribute spread.
 *
 * escalating: each step above `start` costs its distance from `start`
 *   (start+1 costs 1, start+2 costs 2, ...). Dropping any attribute below
 *   `start` refunds exactly `belowStartRefund` points, once per character
 *   total, no matter how many attributes are lowered or how far.
 * flat: 1 point per step above `start`, 1 refunded per step below.
 */
export function attributePointsSpent(
	rules: AttributeCreationRules,
	values: Record<string, number>
): number {
	let spent = 0;
	let anyBelowStart = false;

	for (const value of Object.values(values)) {
		if (rules.mode === 'flat') {
			spent += value - rules.start;
		} else {
			for (let v = rules.start + 1; v <= value; v++) spent += v - rules.start;
			if (value < rules.start) anyBelowStart = true;
		}
	}

	if (rules.mode === 'escalating' && anyBelowStart) {
		spent -= rules.belowStartRefund ?? 0;
	}
	return spent;
}

/** Cost of moving a single attribute one step up from `current` (escalating or flat). */
export function nextStepCost(rules: AttributeCreationRules, current: number): number {
	if (rules.mode === 'flat') return 1;
	return Math.max(1, current + 1 - rules.start);
}
