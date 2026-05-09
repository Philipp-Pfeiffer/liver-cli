export type Sex = 'male' | 'female' | 'other';
export type BACFormula = 'watson' | 'widmark';

export interface ProfileParams {
  weightKg: number;
  heightCm: number;
  sex: Sex;
  age: number;
  beta?: number;
  weightSource?: 'measured' | 'estimated';
}

export interface DrinkParams {
  volumeMl: number;
  abv: number;
  durationMinutes: number;
}

export interface DrinkInput extends DrinkParams {
  startedAtMinutesAgo: number;
  stomachFullness: 'empty' | 'some' | 'full';
}

export interface BACResult {
  bacPercent: number;
  minutesUntilSober: number;
}

export interface CurvePoint {
  offsetMinutes: number;
  bacPercent: number;
}

export interface CurveResult {
  points: CurvePoint[];
}

// Mapping constants for ethanol-rs WASM bridge

export const STOMACH_MAP = {
  empty: 'empty',
  some: 'some_food',
  full: 'full',
} as const;

export const SEX_MAP = {
  male: 'male',
  female: 'female',
  other: 'other',
} as const;

/**
 * STOMACH_FACTORS — absorption-side multipliers.
 *
 * NOTE: As of v0.3.0 these constants are documentary only. The actual
 * bioavailability application happens inside the compiled ethanol-rs
 * WASM (vendor/ethanol-rs/pkg/), which has its own hardcoded values.
 * Updating these constants does NOT change runtime BAC outputs.
 * Tracked for WASM rebuild in ADR-005.
 */
// Bioavailability-Faktoren für den Absorptionsterm
// 0.80 = conservative interpolation, no direct empirical measurement
// (Jones 1994 only validated 0.64 for full meal)
export const STOMACH_FACTORS = {
  empty: 1.0,
  some: 0.8,
  full: 0.65,
} as const;

// ka in h^-1, aus Wilkinson 1977 (siehe Spec §X.12)
export const KA_BY_STOMACH = {
  empty: 4.0,
  some: 2.5,
  full: 1.5,
} as const;