import type { ProfileParams, DrinkInput } from '../../src/engine/types.js'

export const STANDARD_MALE: ProfileParams = {
	sex: 'male',
	age: 30,
	heightCm: 180,
	weightKg: 80,
}

export const STANDARD_FEMALE: ProfileParams = {
	sex: 'female',
	age: 30,
	heightCm: 165,
	weightKg: 65,
}

// Edge-Cases
export const SLIM_MALE: ProfileParams = { ...STANDARD_MALE, weightKg: 60, heightCm: 185 }
export const HEAVY_FEMALE: ProfileParams = { ...STANDARD_FEMALE, weightKg: 95, heightCm: 160 }

// Helper to create DrinkInput from spec-style drink definition
export interface SpecDrink {
	volumeMl: number
	abv: number
	stomach: 'empty' | 'some' | 'full'
	startedAt: Date
	finishedAt: Date
}

export function toDrinkInput(drink: SpecDrink, referenceTime: Date): DrinkInput {
	return {
		volumeMl: drink.volumeMl,
		abv: drink.abv,
		stomachFullness: drink.stomach,
		startedAtMinutesAgo: (referenceTime.getTime() - drink.startedAt.getTime()) / 60000,
		durationMinutes: (drink.finishedAt.getTime() - drink.startedAt.getTime()) / 60000,
	}
}

// Standard-Drinks
export function shotVodka(stomach: 'empty' | 'some' | 'full' = 'empty'): Omit<SpecDrink, 'startedAt' | 'finishedAt'> {
	return { volumeMl: 40, abv: 0.40, stomach }
}

export function pintBeer(stomach: 'empty' | 'some' | 'full' = 'empty'): Omit<SpecDrink, 'startedAt' | 'finishedAt'> {
	return { volumeMl: 500, abv: 0.05, stomach }
}

export function glassWine(stomach: 'empty' | 'some' | 'full' = 'empty'): Omit<SpecDrink, 'startedAt' | 'finishedAt'> {
	return { volumeMl: 150, abv: 0.13, stomach }
}

export function massBeer(stomach: 'empty' | 'some' | 'full' = 'some'): Omit<SpecDrink, 'startedAt' | 'finishedAt'> {
	return { volumeMl: 1000, abv: 0.05, stomach }
}

// Watson TBW and r calculations for testing
export function calculateTBW(profile: ProfileParams): number {
	if (profile.sex === 'male') {
		return 2.447 - 0.09156 * profile.age + 0.1074 * profile.heightCm + 0.3362 * profile.weightKg
	}
	return -2.097 + 0.1069 * profile.heightCm + 0.2466 * profile.weightKg
}

export function calculateR(profile: ProfileParams): number {
	const tbw = calculateTBW(profile)
	return tbw / (profile.weightKg * 1.055)
}

export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000)
}
