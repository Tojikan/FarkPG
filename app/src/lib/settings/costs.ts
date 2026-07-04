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
 *   (start+1 costs 1, start+2 costs 2, ...). Each step below `start`
 *   refunds 1 point (flat), same as flat mode for decreases.
 * flat: 1 point per step above or below `start`.
 */
export function attributePointsSpent(
	rules: AttributeCreationRules,
	values: Record<string, number>
): number {
	let spent = 0;

	for (const value of Object.values(values)) {
		if (rules.mode === 'flat') {
			spent += value - rules.start;
		} else if (value >= rules.start) {
			for (let v = rules.start + 1; v <= value; v++) spent += v - rules.start;
		} else {
			spent += value - rules.start;
		}
	}

	return spent;
}

/** Cost of moving a single attribute one step up from `current` (escalating or flat). */
export function nextStepCost(rules: AttributeCreationRules, current: number): number {
	if (rules.mode === 'flat') return 1;
	if (current >= rules.max) return 0;
	return Math.max(1, current + 1 - rules.start);
}

/** Points refunded when decreasing `current` by one step. */
export function prevStepCost(rules: AttributeCreationRules, current: number): number {
	if (current <= rules.min) return 0;
	if (rules.mode === 'flat') return 1;
	if (current > rules.start) return current - rules.start;
	return 1;
}

/** Cost of the next skill rank, or 0 at max. */
export function nextSkillRankCost(rankCosts: number[], currentRank: number, maxRank: number): number {
	if (currentRank >= maxRank) return 0;
	return rankCosts[currentRank] ?? rankCosts[rankCosts.length - 1] ?? 1;
}

/** Points refunded when lowering a skill rank by one. */
export function prevSkillRankCost(rankCosts: number[], currentRank: number): number {
	if (currentRank <= 0) return 0;
	return rankCosts[currentRank - 1] ?? rankCosts[rankCosts.length - 1] ?? 1;
}

/** Human-readable label for a background bonus pool. */
export function poolPointLabel(pool: 'attributes' | 'skills' | 'abilities'): string {
	switch (pool) {
		case 'attributes':
			return 'attribute points';
		case 'skills':
			return 'skill points';
		case 'abilities':
			return 'ability points';
	}
}
