import type Database from 'better-sqlite3';
import { validateVolume, validateABV, validateDuration, validateStomachState } from '../errors/validation.js';
import {
  DRINK_ALREADY_RUNNING,
  NO_DRINK_TO_STOP,
  TIMESTAMP_OUTSIDE_SESSION,
  DRINK_NOT_FOUND,
  INVALID_TIME_ORDER,
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
  referenceTime?: Date,
): number {
  const profile = requireProfile(db, 'add');
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(sessionId) as DrinkData[];
  
  const ref = referenceTime ?? nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, ref);
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
    stomach?: string;
    sessionNew?: boolean;
    sessionName?: string;
  },
): { drink_id: number; session_id: number; started_at: string; finished_at: string; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string; bac_after_promille: number } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const at = options.at ?? nowUTC();
  const durationMinutes = options.duration ? parseDuration(options.duration) : 0;
  validateDuration(durationMinutes);
  
  let session = options.sessionNew ? null : findSessionForTimestamp(db, at);
  if (!session) {
    if (options.sessionNew) {
      // Close any active sessions before creating a new one
      const activeSession = db.prepare(
        'SELECT id FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
      ).get() as { id: number } | undefined;
      
      if (activeSession) {
        db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
          formatISOUTC(at),
          activeSession.id,
        );
      }
      
      // Create retroactive session
      const stomachState = options.stomach ?? 'some';
      validateStomachState(stomachState);
      
      const sessionResult = db.prepare(
        'INSERT INTO sessions (name, started_at, ended_at, stomach_initial) VALUES (?, ?, ?, ?)'
      ).run(
        options.sessionName ?? null,
        formatISOUTC(at),
        null,
        stomachState,
      );
      
      const sessionId = sessionResult.lastInsertRowid as number;
      db.prepare(
        'INSERT INTO stomach_events (session_id, at, state) VALUES (?, ?, ?)'
      ).run(sessionId, formatISOUTC(at), stomachState);
      
      session = { id: sessionId };
    } else {
      throw TIMESTAMP_OUTSIDE_SESSION();
    }
  }
  
  let stomachState: string;
  if (options.stomach) {
    validateStomachState(options.stomach);
    stomachState = options.stomach;
  } else {
    stomachState = resolveStomachStateAt(db, session.id, at);
  }
  
  const finishedAt = new Date(at.getTime() + durationMinutes * 60000);
  
  let result: Database.RunResult;
  db.transaction(() => {
    result = db.prepare(
      'INSERT INTO drinks (session_id, started_at, finished_at, volume_ml, abv, preset_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      session.id,
      formatISOUTC(at),
      formatISOUTC(finishedAt),
      options.volumeMl,
      options.abv,
      options.presetName ?? null,
    );
  }).immediate();
  
  const bacAfter = computeBACAfter(db, session.id, at);
  
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
    at?: Date;
    duration?: string;
    stomach?: string;
  },
): { drink_id: number; session_id: number; started_at: string; finished_at: string | null; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string; bac_after_promille: number } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  const durationMinutes = options.duration ? parseDuration(options.duration) : 0;
  validateDuration(durationMinutes);
  
  const runningDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NULL'
  ).get(session.id) as DrinkData | undefined;
  
  if (runningDrink && !options.force) {
    throw DRINK_ALREADY_RUNNING();
  }
  
  let stomachState: string;
  if (options.stomach) {
    validateStomachState(options.stomach);
    stomachState = options.stomach;
  } else {
    stomachState = resolveStomachStateAt(db, session.id, at);
  }
  
  const finishedAt = durationMinutes > 0 ? new Date(at.getTime() + durationMinutes * 60000) : null;
  
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
      finishedAt ? formatISOUTC(finishedAt) : null,
      options.volumeMl,
      options.abv,
      options.presetName ?? null,
    );
  }).immediate();
  
  const bacAfter = computeBACAfter(db, session.id, at);

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
  
  const startedAt = new Date(drink.started_at);
  if (at < startedAt) {
    throw INVALID_TIME_ORDER();
  }
  
  db.prepare(
    'UPDATE drinks SET finished_at = ? WHERE id = ?'
  ).run(formatISOUTC(at), drink.id);
  
  const durationSecs = (at.getTime() - startedAt.getTime()) / 1000;
  
  return {
    drink_id: drink.id,
    finished_at: formatISOUTC(at),
    duration_secs: Math.round(durationSecs),
  };
}

export function listDrinks(db: Database.Database): { drinks: DrinkData[]; count: number } {
  const drinks = db.prepare(
    'SELECT * FROM drinks ORDER BY started_at DESC'
  ).all() as DrinkData[];
  return { drinks, count: drinks.length };
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
