import { calculateBACAtOffset, getMinutesUntilSober, getCurve } from '../../src/engine/index.js'
import type { ProfileParams, DrinkInput, CurveResult } from '../../src/engine/types.js'
import { toDrinkInput, addMinutes } from './profiles.js'
import type { SpecDrink } from './profiles.js'

export function calculateBAC(
	drinks: SpecDrink[],
	profile: ProfileParams,
	at: Date,
	t0: Date,
): number {
	// Position drinks relative to evaluation time `at`
	const engineDrinks = drinks.map(d => toDrinkInput(d, at))
	// offsetMinutes = 0 because drinks are already positioned relative to `at`
	return calculateBACAtOffset(profile, engineDrinks, 'watson', 0)
}

export function minutesUntilSober(
	drinks: SpecDrink[],
	profile: ProfileParams,
	t0: Date,
): number {
	// Position drinks relative to t0
	const engineDrinks = drinks.map(d => toDrinkInput(d, t0))
	return getMinutesUntilSober(profile, engineDrinks, 'watson')
}

export function generateCurveForTests(
	drinks: SpecDrink[],
	profile: ProfileParams,
	t0: Date,
	durationMinutes: number,
): CurveResult {
	const engineDrinks = drinks.map(d => toDrinkInput(d, t0))
	return getCurve(profile, engineDrinks, 'watson', 0, durationMinutes, 1, 0.03, 0.06)
}
