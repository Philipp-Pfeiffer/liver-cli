import type {
  ProfileParams,
  DrinkInput,
  BACResult,
  CurveResult,
  BACFormula,
} from './types.js';

export function calculateBAC(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  nowOffsetMinutes: number,
): number {
  if (drinks.length === 0) return 0;
  
  const r = profile.sex === 'female' ? 0.55 : profile.sex === 'other' ? 0.615 : 0.68;
  const bodyWater = profile.weightKg * r;
  
  let totalAlcohol = 0;
  for (const drink of drinks) {
    const alcoholGrams = drink.volumeMl * drink.abv * 0.789;
    totalAlcohol += alcoholGrams;
  }
  
  const absorbed = totalAlcohol * 0.9;
  const bacPercent = absorbed / (bodyWater * 10);
  
  const elapsedHours = nowOffsetMinutes / 60;
  const eliminated = elapsedHours * 0.015;
  
  const result = Math.max(0, bacPercent - eliminated);
  return result;
}

export function minutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  const currentBAC = calculateBAC(profile, drinks, formula, 0);
  const hours = currentBAC / 0.015;
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
    const bacPercent = calculateBAC(profile, drinks, formula, -offset);
    points.push({ offsetMinutes: offset, bacPercent });
  }
  return { points };
}