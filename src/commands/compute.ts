import type Database from 'better-sqlite3';
import type { ProfileParams, DrinkInput, BACFormula } from '../engine/types.js';
import { calculateBACAtOffset, getMinutesUntilSober, resolveFormula, getTrajectory, getAbsorbingDrinkCount } from '../engine/index.js';
import { defaultBeta, clampBeta, effectiveBeta } from '../engine/beta.js';
import type { StomachState } from '../engine/beta.js';
import { requireProfile } from './profile.js';
import { requireActiveSession, getActiveSession, resolveStomachStateAt } from './session.js';
import { getSweetSpotDefaults, getConfig } from '../config/index.js';
import { formatISOUTC, formatISOLocal, nowUTC } from '../time/index.js';
import { CURVE_TOO_LARGE, SESSION_NOT_ACTIVE } from '../errors/index.js';
import type { DrinkData } from './drink.js';

const CV = { measured: 0.11, estimated: 0.19 } as const;

export function ci95(bac: number, weightSource: 'measured' | 'estimated') {
  const cv = CV[weightSource];
  return { lo: Math.max(0, bac * (1 - 2 * cv)), hi: bac * (1 + 2 * cv) };
}

export function profileToEngine(
  profile: { weight_kg: number; height_cm: number; sex: string; age: number; weight_source?: 'measured' | 'estimated' | null },
  stomachState?: StomachState,
): ProfileParams {
  const sex = profile.sex === 'f' ? 'female' : profile.sex === 'o' ? 'other' : 'male';
  const baseBeta = defaultBeta(profile.sex as 'm' | 'f' | 'o', profile.age);
  const beta = stomachState ? clampBeta(effectiveBeta(baseBeta, stomachState)) : clampBeta(baseBeta);

  return {
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    sex,
    age: profile.age,
    beta,
    weightSource: profile.weight_source ?? 'estimated',
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

function addCIFields(
  response: Record<string, unknown>,
  bacPromille: number,
  weightSource: 'measured' | 'estimated',
) {
  const { lo, hi } = ci95(bacPromille, weightSource);
  response.bac_promille_ci95 = [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100];
  response.ci_basis = weightSource === 'measured' ? 'weight_measured' : 'weight_estimated';
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
      bac_promille_ci95: [0, 0],
      ci_basis: 'weight_estimated',
      minutes_until_sober: 0,
      warnings: ['no_active_session'],
      disclaimer: 'estimate, not legally/medically valid',
    };
  }

  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );

  const now = options.at ?? nowUTC();
  const stomachStateNow = resolveStomachStateAt(db, session.id, now) as StomachState;
  const engineProfile = profileToEngine(profile, stomachStateNow);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const refNow = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, refNow);
  const offsetMinutes = (now.getTime() - refNow.getTime()) / 60000;

  const bacPromille = calculateBACAtOffset(engineProfile, engineDrinks, formula, offsetMinutes);
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
    bac_percent: Math.round(bacPromille * 100) / 1000,
    bac_promille: Math.round(bacPromille * 100) / 100,
    trajectory,
    absorbing_drinks: absorbingDrinks,
    minutes_until_sober: minutesUntil,
    sober_at: formatISOLocal(soberAt),
    zone,
    drinks_in_session: drinks.length,
    stomach_state_now: stomachStateNow,
    disclaimer: 'estimate, not legally/medically valid',
  };

  addCIFields(response, bacPromille, engineProfile.weightSource ?? 'estimated');

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

  const stomachStateAt = resolveStomachStateAt(db, session.id, at) as StomachState;
  const engineProfile = profileToEngine(profile, stomachStateAt);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const refNow = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, refNow);
  const offsetMinutes = (at.getTime() - refNow.getTime()) / 60000;
  const bacPromille = calculateBACAtOffset(engineProfile, engineDrinks, formula, offsetMinutes);

  const sweetSpot = getSweetSpotDefaults(db);
  const zone = getZone(bacPromille, sweetSpot.min, sweetSpot.max);

  const response: Record<string, unknown> = {
    at: formatISOLocal(at),
    bac_percent: Math.round(bacPromille * 100) / 1000,
    bac_promille: Math.round(bacPromille * 100) / 100,
    zone,
    formula,
    disclaimer: 'estimate, not legally/medically valid',
  };

  addCIFields(response, bacPromille, engineProfile.weightSource ?? 'estimated');

  return response;
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

  const now = options.at ?? nowUTC();
  const stomachStateNow = resolveStomachStateAt(db, session.id, now) as StomachState;
  const engineProfile = profileToEngine(profile, stomachStateNow);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const refNow = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, refNow);

  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const soberAt = new Date(now.getTime() + minutesUntil * 60000);

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
    const stomachStateNow = resolveStomachStateAt(db, session.id, now) as StomachState;
    const engineProfile = profileToEngine(profile, stomachStateNow);
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

  const stomachStateNow = resolveStomachStateAt(db, session.id, now) as StomachState;
  const engineProfile = profileToEngine(profile, stomachStateNow);

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
  const engineDrinks = drinksToEngine(db, drinks, now);
  for (let offset = 0; offset <= totalMinutes; offset += stepMinutes) {
    const pointTime = new Date(from.getTime() + offset * 60000);
    const offsetMinutes = (pointTime.getTime() - now.getTime()) / 60000;
    const bacPromille = calculateBACAtOffset(engineProfile, engineDrinks, formula, offsetMinutes);
    const { lo, hi } = ci95(bacPromille, engineProfile.weightSource ?? 'estimated');

    curvePoints.push({
      at: formatISOLocal(pointTime),
      bac_promille: Math.round(bacPromille * 100) / 100,
      bac_promille_ci95: [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100],
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
      ci_basis: engineProfile.weightSource === 'measured' ? 'weight_measured' : 'weight_estimated',
    },
    disclaimer: 'estimate, not legally/medically valid',
  };
}
