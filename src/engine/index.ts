import type {
  ProfileParams,
  DrinkInput,
  BACResult,
  CurveResult,
  BACFormula,
} from './types.js';
import {
  calculateBAC as ethanolCalculateBAC,
  minutesUntilSober as ethanolMinutesUntilSober,
  generateCurve as ethanolGenerateCurve,
} from './ethanol.js';
import {
  getTrajectory as wasmGetTrajectory,
  getAbsorbingDrinkCount as wasmGetAbsorbingDrinkCount,
} from './wasm-loader.js';
import { initWasm } from './wasm-loader.js';

initWasm();

export function calculateBACAtOffset(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  offsetMinutes: number,
): number {
  return ethanolCalculateBAC(profile, drinks, formula, offsetMinutes);
}

export function getMinutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  return ethanolMinutesUntilSober(profile, drinks, formula);
}

export function getCurve(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  fromOffset: number,
  toOffset: number,
  stepMinutes: number,
  sweetMin: number,
  sweetMax: number,
): CurveResult {
  return ethanolGenerateCurve(
    profile, drinks, formula,
    fromOffset, toOffset, stepMinutes,
    sweetMin, sweetMax,
  );
}

export function resolveFormula(
  profileFormula: BACFormula | null | undefined,
  overrideFormula: BACFormula | undefined,
): BACFormula {
  return overrideFormula ?? profileFormula ?? 'watson';
}

export function getTrajectory(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): string {
  return wasmGetTrajectory(profile, drinks, formula);
}

export function getAbsorbingDrinkCount(drinks: DrinkInput[]): number {
  return wasmGetAbsorbingDrinkCount(drinks);
}
