import type {
  ProfileParams,
  DrinkInput,
  BACFormula,
  CurveResult,
} from './types.js';
import {
  calculateBACAtOffset as wasmCalculateBAC,
  getMinutesUntilSober as wasmMinutesUntilSober,
  generateCurve as wasmGenerateCurve,
} from './wasm-loader.js';

export function calculateBAC(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  nowOffsetMinutes: number,
): number {
  return wasmCalculateBAC(profile, drinks, formula, nowOffsetMinutes);
}

export function minutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  return wasmMinutesUntilSober(profile, drinks, formula);
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
  return wasmGenerateCurve(
    profile, drinks, formula,
    fromOffsetMinutes, toOffsetMinutes, stepMinutes,
    sweetSpotMin, sweetSpotMax,
  );
}
