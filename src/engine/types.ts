export type Sex = 'male' | 'female' | 'other';
export type BACFormula = 'watson' | 'widmark';

export interface ProfileParams {
  weightKg: number;
  heightCm: number;
  sex: Sex;
  age: number;
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

// ka in h^-1, aus Wilkinson 1977 (siehe Spec §X.12)
export const KA_BY_STOMACH = {
  empty: 4.0,
  some: 2.5,
  full: 1.5,
} as const;