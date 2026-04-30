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