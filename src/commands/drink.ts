import type Database from 'better-sqlite3';
import { validateVolume, validateABV, validateDuration } from '../errors/validation.js';
import {
  DRINK_ALREADY_RUNNING,
  NO_DRINK_TO_STOP,
  TIMESTAMP_OUTSIDE_SESSION,
  DRINK_NOT_FOUND,
} from '../errors/index.js';
import { formatISOUTC, nowUTC, parseDuration } from '../time/index.js';
import { requireActiveSession, resolveStomachStateAt } from './session.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { calculateBACAtOffset } from '../engine/index.js';
import type { BACFormula } from '../engine/types.js';
import type { PresetData } from './preset.js';

export interface DrinkData {
  id: number;
  session_id: number;
  started_at: string;
  finished_at: string | null;
  volume_ml: number;
  abv: number;
  preset_name: string | null;
}

function computeBACAfter(
  db: Database.Database,
  sessionId: number,
): number {
  const profile = requireProfile(db, 'add');
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(sessionId) as DrinkData[];
  
  const now = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, now);
  const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
  const bacPromille = bacPercent * 10;
  
  return Math.round(bacPromille * 100) / 100;
}

export function addDrink(
  db: Database.Database,
  options: {
    volumeMl: number;
    abv: number;
    at?: Date;
    duration?: string;
    presetName?: string;
  },
): { drink_id: number; session_id: number; started_at: string; finished_at: string; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string; bac_after_promille: number } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const at = options.at ?? nowUTC();
  const durationMinutes = options.duration ? parseDuration(options.duration) : 0;
  validateDuration(durationMinutes);
  
  const session = findSessionForTimestamp(db, at);
  if (!session) {
    throw TIMESTAMP_OUTSIDE_SESSION();
  }
  
  const stomachState = resolveStomachStateAt(db, session.id, at);
  
  const finishedAt = new Date(at.getTime() + durationMinutes * 60000);
  
  const result = db.prepare(
    'INSERT INTO drinks (session_id, started_at, finished_at, volume_ml, abv, preset_name) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    session.id,
    formatISOUTC(at),
    formatISOUTC(finishedAt),
    options.volumeMl,
    options.abv,
    options.presetName ?? null,
  );
  
  const bacAfter = computeBACAfter(db, session.id);
  
  return {
    drink_id: result.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    finished_at: formatISOUTC(finishedAt),
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
    bac_after_promille: bacAfter,
  };
}

export function startDrink(
  db: Database.Database,
  options: {
    volumeMl: number;
    abv: number;
    presetName?: string;
    force?: boolean;
  },
): { drink_id: number; session_id: number; started_at: string; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string; bac_after_promille: number } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const session = requireActiveSession(db);
  const at = nowUTC();
  
  const runningDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NULL'
  ).get(session.id) as DrinkData | undefined;
  
  if (runningDrink && !options.force) {
    throw DRINK_ALREADY_RUNNING();
  }
  
  const stomachState = resolveStomachStateAt(db, session.id, at);
  
  let result: Database.RunResult;
  
  db.transaction(() => {
    if (runningDrink && options.force) {
      db.prepare('UPDATE drinks SET finished_at = ? WHERE id = ?').run(formatISOUTC(at), runningDrink.id);
    }
    
    result = db.prepare(
      'INSERT INTO drinks (session_id, started_at, finished_at, volume_ml, abv, preset_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      session.id,
      formatISOUTC(at),
      null,
      options.volumeMl,
      options.abv,
      options.presetName ?? null,
    );
  })();
  
  const bacAfter = computeBACAfter(db, session.id);

  return {
    drink_id: result!.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
    bac_after_promille: bacAfter,
  };
}

export function stopDrink(
  db: Database.Database,
  options: { at?: Date } = {},
): { drink_id: number; finished_at: string; duration_secs: number } {
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  
  const drink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NULL'
  ).get(session.id) as DrinkData | undefined;
  
  if (!drink) {
    throw NO_DRINK_TO_STOP();
  }
  
  db.prepare(
    'UPDATE drinks SET finished_at = ? WHERE id = ?'
  ).run(formatISOUTC(at), drink.id);
  
  const startedAt = new Date(drink.started_at);
  const durationSecs = (at.getTime() - startedAt.getTime()) / 1000;
  
  return {
    drink_id: drink.id,
    finished_at: formatISOUTC(at),
    duration_secs: Math.round(durationSecs),
  };
}

export function listDrinks(db: Database.Database): { items: DrinkData[]; count: number } {
  const items = db.prepare(
    'SELECT * FROM drinks ORDER BY started_at DESC'
  ).all() as DrinkData[];
  return { items, count: items.length };
}

export function removeDrink(
  db: Database.Database,
  id: number,
): { ok: true; drink_id: number } {
  const drink = db.prepare('SELECT * FROM drinks WHERE id = ?').get(id) as DrinkData | undefined;
  
  if (!drink) {
    throw DRINK_NOT_FOUND(id);
  }
  
  db.prepare('DELETE FROM drinks WHERE id = ?').run(id);
  
  return { ok: true, drink_id: id };
}

export function getRunningDrink(db: Database.Database): DrinkData | null {
  const session = requireActiveSession(db);
  const drink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NULL'
  ).get(session.id) as DrinkData | undefined;
  
  return drink ?? null;
}

function findSessionForTimestamp(db: Database.Database, at: Date): { id: number } | null {
  const session = db.prepare(
    `SELECT id FROM sessions 
     WHERE started_at <= ? 
     AND (ended_at IS NULL OR ended_at >= ?)
     ORDER BY started_at DESC
     LIMIT 1`
  ).get(formatISOUTC(at), formatISOUTC(at)) as { id: number } | undefined;
  
  return session ?? null;
}
