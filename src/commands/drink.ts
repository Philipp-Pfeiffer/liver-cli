import type Database from 'better-sqlite3';
import { validateVolume, validateABV, validateDuration, validateStomachState } from '../errors/validation.js';
import {
  E_DRINK_ALREADY_OPEN,
  E_NO_OPEN_DRINK,
  TIMESTAMP_OUTSIDE_SESSION,
  DRINK_NOT_FOUND,
  INVALID_TIME_ORDER,
} from '../errors/index.js';
import { formatISOUTC, nowUTC, parseDuration } from '../time/index.js';
import { requireActiveSession, resolveStomachStateAt } from './session.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { calculateBACAtOffset, getMinutesUntilSober, getTrajectory } from '../engine/index.js';
import { projectedPeakFromCurve } from '../engine/peak.js';
import { resolveDefaultDuration } from '../lib/duration.js';
import type { BACFormula } from '../engine/types.js';
import type { PresetData } from './preset.js';
import { getConfig } from '../config/index.js';

export interface DrinkData {
  id: number;
  session_id: number;
  started_at: string;
  finished_at: string | null;
  volume_ml: number;
  abv: number;
  preset_name: string | null;
}

export type ProjectionBasis = 'planned_duration' | 'volume_default' | 'finalized';
export type DefaultDurationSource = 'config_override' | 'volume_table' | 'fallback_20min';
export type Trajectory = 'rising' | 'falling' | 'stable';

function computeBACBefore(
  db: Database.Database,
  sessionId: number,
  referenceTime: Date,
): number {
  const profile = requireProfile(db, 'add');
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(sessionId) as DrinkData[];

  const engineDrinks = drinksToEngine(db, drinks, referenceTime);
  const bacPromille = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);

  return Math.round(bacPromille * 100) / 100;
}

function computeProjectedPeak(
  db: Database.Database,
  sessionId: number,
  referenceTime: Date,
): { bac_projected_peak_promille: number; bac_projected_peak_at: string } {
  const profile = requireProfile(db, 'add');
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(sessionId) as DrinkData[];

  const engineDrinks = drinksToEngine(db, drinks, referenceTime);

  // Search from referenceTime to referenceTime + 4h for peak
  const endSearch = new Date(referenceTime.getTime() + 4 * 60 * 60 * 1000);
  const peak = projectedPeakFromCurve(engineProfile, engineDrinks, formula, referenceTime, endSearch);

  return {
    bac_projected_peak_promille: Math.round(peak.bac * 100) / 100,
    bac_projected_peak_at: formatISOUTC(peak.timestamp),
  };
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
): {
  drink_id: number;
  session_id: number;
  started_at: string;
  finished_at: string;
  volume_ml: number;
  abv: number;
  preset_name: string | null;
  stomach_state: string;
  bac_before_promille: number;
  bac_projected_peak_promille: number;
  bac_projected_peak_at: string;
  drink_in_progress: false;
  bac_after_promille: number; // deprecated alias
} {
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
        'SELECT id, started_at FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
      ).get() as { id: number; started_at: string } | undefined;

      if (activeSession) {
        const activeSessionStart = new Date(activeSession.started_at);
        if (at < activeSessionStart) {
          throw INVALID_TIME_ORDER();
        }
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

  let result: Database.RunResult | undefined;
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

  if (!result) {
    throw new Error('Failed to insert drink');
  }

  const bacBefore = computeBACBefore(db, session.id, at);
  const peak = computeProjectedPeak(db, session.id, at);

  return {
    drink_id: result.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    finished_at: formatISOUTC(finishedAt),
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
    bac_before_promille: bacBefore,
    bac_projected_peak_promille: peak.bac_projected_peak_promille,
    bac_projected_peak_at: peak.bac_projected_peak_at,
    drink_in_progress: false,
    bac_after_promille: peak.bac_projected_peak_promille, // deprecated, alias for projected_peak
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
): {
  drink_id: number;
  session_id: number;
  started_at: string;
  finished_at: string;
  duration_secs: number;
  volume_ml: number;
  abv: number;
  preset_name: string | null;
  stomach_state: string;
  bac_before_promille: number;
  bac_projected_peak_promille: number;
  bac_projected_peak_at: string;
  projection_basis: ProjectionBasis;
  default_duration_source?: DefaultDurationSource;
  drink_in_progress: true;
  force_closed_drinks?: Array<{ drink_id: number; finished_at: string }>;
  bac_after_promille: number; // deprecated alias
} {
  validateVolume(options.volumeMl);
  validateABV(options.abv);

  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();

  const openDrink = db.prepare(
    "SELECT * FROM drinks WHERE session_id = ? AND (finished_at IS NULL OR datetime(finished_at) > datetime(?)) ORDER BY started_at DESC LIMIT 1"
  ).get(session.id, formatISOUTC(at)) as DrinkData | undefined;

  if (openDrink && !options.force) {
    const elapsedMin = Math.round((at.getTime() - new Date(openDrink.started_at).getTime()) / 60000);
    throw E_DRINK_ALREADY_OPEN(openDrink.id, elapsedMin);
  }

  let stomachState: string;
  if (options.stomach) {
    validateStomachState(options.stomach);
    stomachState = options.stomach;
  } else {
    stomachState = resolveStomachStateAt(db, session.id, at);
  }

  // Resolve duration before transaction to avoid nested DB calls
  let durationMinutes: number;
  let projectionBasis: ProjectionBasis;
  let defaultDurationSource: DefaultDurationSource | undefined;

  if (options.duration) {
    durationMinutes = parseDuration(options.duration);
    validateDuration(durationMinutes);
    projectionBasis = 'planned_duration';
  } else {
    const defaultDuration = getConfig('default_duration_minutes', db) as number | undefined;
    const config = typeof defaultDuration === 'number'
      ? { default_duration_minutes: defaultDuration }
      : {};
    const resolved = resolveDefaultDuration(options.volumeMl, config);
    durationMinutes = resolved.minutes;
    projectionBasis = 'volume_default';
    defaultDurationSource = resolved.source;
  }

  const finishedAt = new Date(at.getTime() + durationMinutes * 60000);

  let result: Database.RunResult | undefined;
  const forceClosedDrinks: Array<{ drink_id: number; finished_at: string }> = [];

  db.transaction(() => {
    if (openDrink && options.force) {
      db.prepare('UPDATE drinks SET finished_at = ? WHERE id = ?').run(formatISOUTC(at), openDrink.id);
      forceClosedDrinks.push({
        drink_id: openDrink.id,
        finished_at: formatISOUTC(at),
      });
    }

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

  if (!result) {
    throw new Error('Failed to insert drink');
  }

  const bacBefore = computeBACBefore(db, session.id, at);
  const peak = computeProjectedPeak(db, session.id, at);

  const durationSecs = Math.round((finishedAt.getTime() - at.getTime()) / 1000);

  const response: ReturnType<typeof startDrink> = {
    drink_id: result.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    finished_at: formatISOUTC(finishedAt),
    duration_secs: durationSecs,
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
    bac_before_promille: bacBefore,
    bac_projected_peak_promille: peak.bac_projected_peak_promille,
    bac_projected_peak_at: peak.bac_projected_peak_at,
    projection_basis: projectionBasis,
    drink_in_progress: true,
    bac_after_promille: peak.bac_projected_peak_promille,
  };

  if (defaultDurationSource) {
    response.default_duration_source = defaultDurationSource;
  }

  if (forceClosedDrinks.length > 0) {
    response.force_closed_drinks = forceClosedDrinks;
  }

  return response;
}

export function stopDrink(
  db: Database.Database,
  options: { at?: Date } = {},
): {
  drink_id: number;
  finished_at: string;
  duration_secs: number;
  bac_at_stop_promille: number;
  bac_projected_peak_promille: number;
  bac_projected_peak_at: string;
  trajectory: Trajectory;
} {
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();

  const drink = db.prepare(
    "SELECT * FROM drinks WHERE session_id = ? AND (finished_at IS NULL OR datetime(finished_at) > datetime(?)) ORDER BY started_at DESC LIMIT 1"
  ).get(session.id, formatISOUTC(at)) as DrinkData | undefined;

  if (!drink) {
    throw E_NO_OPEN_DRINK();
  }

  const startedAt = new Date(drink.started_at);
  if (at < startedAt) {
    throw INVALID_TIME_ORDER();
  }

  db.prepare(
    'UPDATE drinks SET finished_at = ? WHERE id = ?'
  ).run(formatISOUTC(at), drink.id);

  const durationSecs = (at.getTime() - startedAt.getTime()) / 1000;

  // Compute BAC at stop time
  const profile = requireProfile(db, 'stop');
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);

  const allDrinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const engineDrinks = drinksToEngine(db, allDrinks, at);
  const bacPromille = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
  const bacAtStop = Math.round(bacPromille * 100) / 100;

  const trajectoryRaw = getTrajectory(engineProfile, engineDrinks, formula);
  const trajectory = trajectoryRaw as Trajectory;

  // Compute projected peak with finalized duration
  const endSearch = new Date(at.getTime() + 4 * 60 * 60 * 1000);
  const peak = projectedPeakFromCurve(engineProfile, engineDrinks, formula, at, endSearch);

  return {
    drink_id: drink.id,
    finished_at: formatISOUTC(at),
    duration_secs: Math.round(durationSecs),
    bac_at_stop_promille: bacAtStop,
    bac_projected_peak_promille: Math.round(peak.bac * 100) / 100,
    bac_projected_peak_at: formatISOUTC(peak.timestamp),
    trajectory,
  };
}

export function updateDrink(
  db: Database.Database,
  options: {
    id: number;
    duration?: string;
    finishedAt?: Date;
  },
): {
  drink: DrinkData;
  warning?: string;
} {
  const drink = db.prepare('SELECT * FROM drinks WHERE id = ?').get(options.id) as DrinkData | undefined;

  if (!drink) {
    throw DRINK_NOT_FOUND(options.id);
  }

  if ((options.duration !== undefined && options.finishedAt !== undefined) ||
      (options.duration === undefined && options.finishedAt === undefined)) {
    throw new Error('Must provide exactly one of --duration or --finished-at');
  }

  const startedAt = new Date(drink.started_at);
  let newFinishedAt: Date;

  if (options.duration) {
    const durationMinutes = parseDuration(options.duration);
    validateDuration(durationMinutes);
    newFinishedAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  } else {
    newFinishedAt = options.finishedAt!;
  }

  if (newFinishedAt < startedAt) {
    throw INVALID_TIME_ORDER();
  }

  db.prepare('UPDATE drinks SET finished_at = ?, updated_at = ? WHERE id = ?').run(
    formatISOUTC(newFinishedAt),
    formatISOUTC(nowUTC()),
    options.id,
  );

  const result: { drink: DrinkData; warning?: string } = {
    drink: {
      ...drink,
      finished_at: formatISOUTC(newFinishedAt),
    },
  };

  // If drink was already closed, add warning
  if (drink.finished_at !== null) {
    result.warning = `Updated finished_at on already-closed drink #${options.id}`;
  }

  return result;
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

export function getRunningDrink(db: Database.Database, at: Date = nowUTC()): DrinkData | null {
  const session = requireActiveSession(db);
  const drink = db.prepare(
    "SELECT * FROM drinks WHERE session_id = ? AND (finished_at IS NULL OR datetime(finished_at) > datetime(?)) ORDER BY started_at DESC LIMIT 1"
  ).get(session.id, formatISOUTC(at)) as DrinkData | undefined;

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
