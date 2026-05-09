import type Database from 'better-sqlite3';
import {
  validateWeight,
  validateHeight,
  validateAge,
  validateSex,
} from '../errors/validation.js';
import { formatISOUTC } from '../time/index.js';
import { PROFILE_MISSING, INVALID_CONFIG_KEY } from '../errors/index.js';

export interface ProfileData {
  weight_kg: number;
  height_cm: number;
  sex: string;
  age: number;
  preferred_formula: string | null;
  weight_source: 'measured' | 'estimated';
}

export function setProfile(
  db: Database.Database,
  weightKg: number,
  heightCm: number,
  sex: string,
  age: number,
  formula?: string,
  weightSource?: 'measured' | 'estimated',
): { ok: true } {
  validateWeight(weightKg);
  validateHeight(heightCm);
  validateAge(age);
  validateSex(sex);
  
  if (formula && !['watson', 'widmark'].includes(formula)) {
    throw INVALID_CONFIG_KEY();
  }
  
  if (weightSource && !['measured', 'estimated'].includes(weightSource)) {
    throw INVALID_CONFIG_KEY();
  }
  
  db.prepare('DELETE FROM profile').run();
  
  db.prepare(
    'INSERT INTO profile (weight_kg, height_cm, sex, age, preferred_formula, weight_source) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(weightKg, heightCm, sex, age, formula ?? null, weightSource ?? 'estimated');
  
  return { ok: true };
}

export function getProfile(db: Database.Database): ProfileData | null {
  const row = db.prepare('SELECT * FROM profile LIMIT 1').get() as ProfileData | undefined;
  return row ?? null;
}

export function requireProfile(db: Database.Database, command: string): ProfileData {
  const profile = getProfile(db);
  if (!profile) {
    throw PROFILE_MISSING(command);
  }
  return profile;
}