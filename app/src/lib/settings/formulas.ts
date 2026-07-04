import type { ResourceFormula } from './types';

/**
 * Evaluate a parameterized numeric rule from setting JSON.
 * value = base + (attributes[attribute] - baseline) * perPoint
 * When no attribute is referenced the value is just `base`.
 */
export function evaluateFormula(
	formula: ResourceFormula,
	attributes: Record<string, number>
): number {
	let value = formula.base;
	if (formula.attribute) {
		const attr = attributes[formula.attribute] ?? formula.baseline ?? 0;
		value += (attr - (formula.baseline ?? 0)) * (formula.perPoint ?? 0);
	}
	return Math.max(0, value);
}
