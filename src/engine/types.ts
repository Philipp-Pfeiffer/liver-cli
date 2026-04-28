export type Sex = 'male' | 'female';
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