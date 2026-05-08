/**
 * Sync wrapper around ethanol-rs WASM module.
 * Call initWasm() once at process start (typically in src/index.ts).
 */
import { createRequire } from 'module';
import type {
  ProfileParams,
  DrinkInput,
  BACFormula,
  CurveResult,
  CurvePoint,
} from './types.js';
import { STOMACH_MAP, SEX_MAP } from './types.js';

const require = createRequire(import.meta.url);

let wasmModule: typeof import('../../vendor/ethanol-rs-pkg/ethanol_rs_wasm.js') | null = null;

export function initWasm(): void {
  if (!wasmModule) {
    try {
      wasmModule = require('../../vendor/ethanol-rs-pkg/ethanol_rs_wasm.js');
    } catch {
      wasmModule = require('../vendor/ethanol-rs-pkg/ethanol_rs_wasm.js');
    }
  }
}

function wasm() {
  if (!wasmModule) throw new Error('WASM not initialized — call initWasm() first');
  return wasmModule;
}

function toEthanolDrink(d: DrinkInput, offsetMinutes: number) {
  return wasm().createDrink(
    d.volumeMl,
    d.abv,
    -(d.startedAtMinutesAgo + offsetMinutes) * 60,
    d.durationMinutes * 60,
    STOMACH_MAP[d.stomachFullness],
  );
}

function toEthanolProfile(p: ProfileParams) {
  return wasm().createUserProfile(
    p.weightKg,
    SEX_MAP[p.sex],
    p.heightCm,
    p.age,
  );
}

export function calculateBACAtOffset(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  offsetMinutes: number,
): number {
  const ethanolDrinks = drinks.map(d => toEthanolDrink(d, offsetMinutes));
  const ethanolProfile = toEthanolProfile(profile);
  const bacPercent = wasm().calculateBAC(ethanolDrinks, ethanolProfile, formula);
  return bacPercent * 10; // ethanol-rs: BAC % → liver: Promille
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
  const ethanolDrinks = drinks.map(d => toEthanolDrink(d, 0));
  const ethanolProfile = toEthanolProfile(profile);

  const points = wasm().generateCurve(
    ethanolDrinks,
    ethanolProfile,
    formula,
    fromOffsetMinutes * 60,
    toOffsetMinutes * 60,
    stepMinutes * 60,
    sweetSpotMin,
    sweetSpotMax,
  ) as Array<{ offset_secs: number; bac: number; zone: string }>;

  return {
    points: points.map(p => ({
      offsetMinutes: p.offset_secs / 60,
      bacPercent: p.bac * 10,
    })),
  };
}

export function getMinutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  const ethanolDrinks = drinks.map(d => toEthanolDrink(d, 0));
  const ethanolProfile = toEthanolProfile(profile);
  return wasm().minutesUntilSober(ethanolDrinks, ethanolProfile, formula);
}

export function getTrajectory(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): string {
  const ethanolDrinks = drinks.map(d => toEthanolDrink(d, 0));
  const ethanolProfile = toEthanolProfile(profile);
  const result = wasm().calculateTrajectory(ethanolDrinks, ethanolProfile, formula);
  return String(result).toLowerCase();
}

export function getAbsorbingDrinkCount(drinks: DrinkInput[]): number {
  const ethanolDrinks = drinks.map(d => toEthanolDrink(d, 0));
  return wasm().countAbsorbingDrinks(ethanolDrinks);
}
