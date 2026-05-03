import type {
  ProfileParams,
  DrinkInput,
  BACResult,
  CurveResult,
  BACFormula,
} from './types.js';

// Watson r-Werte (body water ratio)
const WATSON_R: Record<string, number> = {
  male: 0.68,
  female: 0.55,
  other: 0.615,
};

// Widmark r-Werte (slightly different)
const WIDMARK_R: Record<string, number> = {
  male: 0.73,
  female: 0.66,
  other: 0.695,
};

// Stomach absorption factors (how quickly alcohol enters bloodstream)
const STOMACH_ABSORPTION: Record<string, number> = {
  empty: 1.0,
  some: 0.85,
  full: 0.65,
};

// Standard elimination rate: 0.015 ‰/h = 0.0015 %/h
// (Engine calculates in %; callers convert to ‰ via ×10)
const ELIMINATION_RATE = 0.0015;

// Ethanol density: 0.789 g/ml
const ETHANOL_DENSITY = 0.789;

function getR(profile: ProfileParams, formula: BACFormula): number {
  const rMap = formula === 'watson' ? WATSON_R : WIDMARK_R;
  return rMap[profile.sex] ?? 0.68;
}

function calculateSingleBAC(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  nowOffsetMinutes: number,
): number {
  if (drinks.length === 0) return 0;

  const r = getR(profile, formula);
  const bodyWater = profile.weightKg * r;

  // Current time is referenceTime + nowOffsetMinutes
  // Drinks have startedAtMinutesAgo relative to referenceTime
  // So a drink's age at current time = startedAtMinutesAgo + nowOffsetMinutes

  let totalBAC = 0;

  for (const drink of drinks) {
    // abv is already in fraction (0.05 for 5%) from drinksToEngine
    const alcoholGrams = drink.volumeMl * drink.abv * ETHANOL_DENSITY;
    const absorptionFactor = STOMACH_ABSORPTION[drink.stomachFullness] ?? 0.85;
    
    // Calculate how much alcohol is absorbed at current time
    const drinkAgeMinutes = drink.startedAtMinutesAgo + nowOffsetMinutes;
    const durationMinutes = drink.durationMinutes;
    
    // Absorption phase: alcohol enters bloodstream over durationMinutes
    let absorbedFraction: number;
    if (drinkAgeMinutes < 0) {
      // Drink is in the future (shouldn't happen in normal use)
      absorbedFraction = 0;
    } else if (durationMinutes <= 0) {
      // Instant drink - fully absorbed immediately
      absorbedFraction = absorptionFactor;
    } else if (drinkAgeMinutes < durationMinutes) {
      // Still absorbing
      absorbedFraction = (drinkAgeMinutes / durationMinutes) * absorptionFactor;
    } else {
      // Fully absorbed
      absorbedFraction = absorptionFactor;
    }

    const absorbedAlcohol = alcoholGrams * absorbedFraction;
    const bacPercent = absorbedAlcohol / (bodyWater * 10);
    totalBAC += bacPercent;
  }

  // Elimination: alcohol leaves system at 0.015% per hour
  // Time elapsed since first drink
  const firstDrinkAge = Math.max(0, ...drinks.map(d => d.startedAtMinutesAgo + nowOffsetMinutes));
  const elapsedHours = firstDrinkAge / 60;
  const eliminated = elapsedHours * ELIMINATION_RATE;

  return Math.max(0, totalBAC - eliminated);
}

export function calculateBAC(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  nowOffsetMinutes: number,
): number {
  return calculateSingleBAC(profile, drinks, formula, nowOffsetMinutes);
}

export function minutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  if (drinks.length === 0) return 0;

  const currentBAC = calculateBAC(profile, drinks, formula, 0);
  if (currentBAC <= 0) return 0;

  const hours = currentBAC / ELIMINATION_RATE;
  return Math.ceil(hours * 60);
}

export function generateCurve(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  fromOffsetMinutes: number,
  toOffsetMinutes: number,
  stepMinutes: number,
  sweetSpotMin: number,
  sweetSpotMax: number,
): CurveResult {
  const points = [];
  for (let offset = fromOffsetMinutes; offset <= toOffsetMinutes; offset += stepMinutes) {
    const bacPercent = calculateBAC(profile, drinks, formula, 0);
    points.push({ offsetMinutes: offset, bacPercent });
  }
  return { points };
}
