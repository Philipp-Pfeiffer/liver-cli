import type Database from 'better-sqlite3';
import type { ProfileParams, DrinkInput, BACFormula } from '../engine/types.js';
import { calculateBACAtOffset, getMinutesUntilSober, resolveFormula, getTrajectory, getAbsorbingDrinkCount } from '../engine/index.js';
import { requireProfile } from './profile.js';
import { requireActiveSession, getActiveSession, resolveStomachStateAt } from './session.js';
import { getSweetSpotDefaults, getConfig } from '../config/index.js';
import { formatISOUTC, formatISOLocal, nowUTC } from '../time/index.js';
import { CURVE_TOO_LARGE, SESSION_NOT_ACTIVE } from '../errors/index.js';
import type { DrinkData } from './drink.js';

export function profileToEngine(profile: { weight_kg: number; height_cm: number; sex: string; age: number }): ProfileParams {
  return {
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    sex: profile.sex === 'f' ? 'female' : profile.sex === 'o' ? 'other' : 'male',
    age: profile.age,
  };
}

export function drinksToEngine(
  db: Database.Database,
  drinks: DrinkData[],
  referenceTime: Date,
): DrinkInput[] {
  return drinks.map(drink => {
    const startedAt = new Date(drink.started_at);
    const finishedAt = drink.finished_at ? new Date(drink.finished_at) : referenceTime;
    const stomachState = resolveStomachStateAt(db, drink.session_id, startedAt);

    return {
      volumeMl: drink.volume_ml,
      abv: drink.abv / 100,
      durationMinutes: (finishedAt.getTime() - startedAt.getTime()) / 60000,
      startedAtMinutesAgo: (referenceTime.getTime() - startedAt.getTime()) / 60000,
      stomachFullness: stomachState as 'empty' | 'some' | 'full',
    };
  });
}

function getZone(bacPromille: number, sweetMin: number, sweetMax: number): string {
  if (bacPromille === 0) return 'sober';
  if (bacPromille < sweetMin) return 'below_sweet_spot';
  if (bacPromille <= sweetMax) return 'sweet_spot';
  if (bacPromille <= 1.0) return 'caution';
  return 'danger';
}

export function getStatus(
  db: Database.Database,
  options: { formula?: BACFormula; at?: Date } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'status');
  const session = getActiveSession(db);

  if (!session) {
    return {
      session_id: null,
      session_name: null,
      bac_promille: 0,
      minutes_until_sober: 0,
      warnings: ['no_active_session'],
      disclaimer: 'estimate, not legally/medically valid',
    };
  }

  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );

  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const now = options.at ?? nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, now);

  const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
  const bacPromille = bacPercent * 10;
  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const soberAt = new Date(now.getTime() + minutesUntil * 60000);

  const sweetSpot = getSweetSpotDefaults(db);
  const zone = getZone(bacPromille, sweetSpot.min, sweetSpot.max);

  const trajectoryRaw = getTrajectory(engineProfile, engineDrinks, formula);
  const trajectory = trajectoryRaw as 'rising' | 'falling' | 'stable';

  const absorbingDrinks = getAbsorbingDrinkCount(engineDrinks);

  // Auto-close detection
  const autoCloseGraceMin = (getConfig('auto_close_grace_minutes', db) as number | undefined) ?? 15;
  const autoClosedDrinks: Array<{ drink_id: number; finished_at: string; source: string }> = [];
  const openDrinks: Array<{ drink_id: number; started_at: string; elapsed_minutes: number; drink_in_progress: true }> = [];

  for (const drink of drinks) {
    if (!drink.finished_at) {
      // Open drink (no finished_at set - should not happen with new schema)
      const elapsedMin = Math.round((now.getTime() - new Date(drink.started_at).getTime()) / 60000);
      openDrinks.push({
        drink_id: drink.id,
        started_at: drink.started_at,
        elapsed_minutes: elapsedMin,
        drink_in_progress: true,
      });
    } else {
      const finishedAt = new Date(drink.finished_at);
      const graceEnd = new Date(finishedAt.getTime() + autoCloseGraceMin * 60000);

      if (now > graceEnd) {
        // Drink is past grace period - treat as auto-closed
        autoClosedDrinks.push({
          drink_id: drink.id,
          finished_at: drink.finished_at,
          source: 'auto_close_grace',
        });
      } else if (now >= finishedAt) {
        // Drink is finished but within grace
        // Not listed as open or auto-closed
      } else {
        // Drink is still in progress (finished_at in future)
        const elapsedMin = Math.round((now.getTime() - new Date(drink.started_at).getTime()) / 60000);
        openDrinks.push({
          drink_id: drink.id,
          started_at: drink.started_at,
          elapsed_minutes: elapsedMin,
          drink_in_progress: true,
        });
      }
    }
  }

  const response: Record<string, unknown> = {
    now: formatISOLocal(now),
    session_id: session.id,
    session_name: session.name,
    bac_percent: Math.round(bacPercent * 1000) / 1000,
    bac_promille: Math.round(bacPromille * 100) / 100,
    trajectory,
    absorbing_drinks: absorbingDrinks,
    minutes_until_sober: minutesUntil,
    sober_at: formatISOLocal(soberAt),
    zone,
    drinks_in_session: drinks.length,
    stomach_state_now: resolveStomachStateAt(db, session.id, now),
    disclaimer: 'estimate, not legally/medically valid',
  };

  if (openDrinks.length > 0) {
    response.open_drinks = openDrinks;
  }

  if (autoClosedDrinks.length > 0) {
    response.auto_closed_drinks = autoClosedDrinks;
  }

  return response;
}

export function getBACAt(
  db: Database.Database,
  at: Date,
  options: { formula?: BACFormula } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'bac');
  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );

  const session = db.prepare(
    `SELECT * FROM sessions
     WHERE started_at <= ?
     AND (ended_at IS NULL OR ended_at >= ?)
     ORDER BY started_at DESC
     LIMIT 1`
  ).get(formatISOUTC(at), formatISOUTC(at)) as { id: number } | undefined;

  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }

  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const engineDrinks = drinksToEngine(db, drinks, at);
  const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
  const bacPromille = bacPercent * 10;

  const sweetSpot = getSweetSpotDefaults(db);
  const zone = getZone(bacPromille, sweetSpot.min, sweetSpot.max);

  return {
    at: formatISOLocal(at),
    bac_percent: Math.round(bacPercent * 1000) / 1000,
    bac_promille: Math.round(bacPromille * 100) / 100,
    zone,
    formula,
    disclaimer: 'estimate, not legally/medically valid',
  };
}

export function getSober(
  db: Database.Database,
  options: { formula?: BACFormula; at?: Date } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'sober');
  const session = getActiveSession(db);

  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }

  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );

  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const at = options.at ?? nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, at);

  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const soberAt = new Date(at.getTime() + minutesUntil * 60000);

  return {
    minutes_until_sober: minutesUntil,
    sober_at: formatISOLocal(soberAt),
    disclaimer: 'estimate, not legally/medically valid',
  };
}

export function getCurve(
  db: Database.Database,
  options: {
    from?: Date;
    to?: Date;
    step?: number;
    formula?: BACFormula;
  } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'curve');
  const session = getActiveSession(db);

  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }

  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );

  const now = nowUTC();
  const from = options.from ?? new Date(session.started_at);

  let to: Date;
  if (options.to) {
    to = options.to;
  } else {
    const engineProfile = profileToEngine(profile);
    const drinks = db.prepare(
      'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
    ).all(session.id) as DrinkData[];
    const engineDrinks = drinksToEngine(db, drinks, now);
    const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
    to = new Date(now.getTime() + minutesUntil * 60000);
  }

  const stepMinutes = options.step ?? 5;

  const totalMinutes = (to.getTime() - from.getTime()) / 60000;
  const points = Math.floor(totalMinutes / stepMinutes) + 1;

  if (points > 1000) {
    const suggestedStep = Math.ceil(totalMinutes / 1000);
    const standardSteps = [1, 5, 10, 30, 60];
    const roundedStep = standardSteps.find(s => s >= suggestedStep) ?? suggestedStep;
    throw CURVE_TOO_LARGE(roundedStep);
  }

  const engineProfile = profileToEngine(profile);

  const drinksRaw = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const sweetSpot = getSweetSpotDefaults(db);

  // Build drink markers for SVG
  const drinkMarkers = drinksRaw.map(d => ({
    at: d.started_at,
    label: d.preset_name || `${d.volume_ml}ml`,
    volume_ml: d.volume_ml,
    abv: d.abv,
  }));

  const drinks = drinksRaw;

  const curvePoints = [];
  for (let offset = 0; offset <= totalMinutes; offset += stepMinutes) {
    const pointTime = new Date(from.getTime() + offset * 60000);
    const engineDrinks = drinksToEngine(db, drinks, pointTime);
    const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
    const bacPromille = bacPercent * 10;

    curvePoints.push({
      at: formatISOLocal(pointTime),
      bac_promille: Math.round(bacPromille * 100) / 100,
      zone: getZone(bacPromille, sweetSpot.min, sweetSpot.max),
    });
  }

  return {
    curve: curvePoints,
    drinks: drinkMarkers,
    meta: {
      from: formatISOLocal(from),
      to: formatISOLocal(to),
      step_min: stepMinutes,
      points: curvePoints.length,
      formula,
    },
    disclaimer: 'estimate, not legally/medically valid',
  };
}
