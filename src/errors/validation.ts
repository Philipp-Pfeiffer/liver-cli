import {
  INVALID_WEIGHT,
  INVALID_HEIGHT,
  AGE_OUT_OF_RANGE,
  INVALID_SEX,
  INVALID_VOLUME,
  INVALID_ABV,
  INVALID_DURATION,
  INVALID_STOMACH_STATE,
  INVALID_PRESET_NAME,
  INVALID_SESSION_NAME,
} from './index.js';

export function validateWeight(weight: number): void {
  if (weight < 30 || weight > 250) throw INVALID_WEIGHT();
}

export function validateHeight(height: number): void {
  if (height < 120 || height > 230) throw INVALID_HEIGHT();
}

export function validateAge(age: number): void {
  if (age < 16 || age > 120) throw AGE_OUT_OF_RANGE();
}

export function validateSex(sex: string): void {
  if (!['m', 'f', 'o'].includes(sex)) throw INVALID_SEX();
}

export function validateVolume(volume: number): void {
  if (volume <= 0 || volume > 5000) throw INVALID_VOLUME();
}

export function validateABV(abv: number): void {
  if (abv <= 0 || abv > 100) throw INVALID_ABV();
}

export function validateDuration(minutes: number): void {
  if (minutes < 0 || minutes > 24 * 60) throw INVALID_DURATION();
}

export function validateStomachState(state: string): void {
  if (!['empty', 'some', 'full'].includes(state)) throw INVALID_STOMACH_STATE();
}

export function validatePresetName(name: string): void {
  if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw INVALID_PRESET_NAME();
}

export function validateSessionName(name: string | undefined): void {
  if (name !== undefined && name.length > 64) throw INVALID_SESSION_NAME();
}