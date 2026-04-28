import type Database from 'better-sqlite3';
import { formatISOUTC, nowUTC } from '../time/index.js';
import type { BACFormula } from '../engine/types.js';
import { resolveFormula, calculateBACAtOffset } from '../engine/index.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { getSweetSpotDefaults } from '../config/index.js';
import type { DrinkData } from './drink.js';

export interface StatsPeriod {
  from: string;
  to: string;
  mode: string;
}

export interface PresetStats {
  name: string;
  count: number;
  total_volume_ml: number;
  total_pure_alcohol_g: number;
}

export interface StatsResult {
  period: StatsPeriod;
  drinking_days: number;
  dry_days: number;
  longest_dry_streak: number;
  current_dry_streak: number;
  total_drinks: number;
  total_sessions: number;
  total_pure_alcohol_g: number;
  avg_peak_promille: number;
  avg_session_promille: number;
  max_session_promille: number;
  by_preset: PresetStats[];
}

function getBerlinOffsetMs(utcDate: Date): number {
  const berlinParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(utcDate);

  const getPart = (type: string) => parseInt(berlinParts.find(p => p.type === type)?.value ?? '0', 10);
  const bYear = getPart('year');
  const bMonth = getPart('month');
  const bDay = getPart('day');
  const bHour = getPart('hour');
  const bMinute = getPart('minute');
  const bSecond = getPart('second');

  const berlinTime = Date.UTC(bYear, bMonth - 1, bDay, bHour, bMinute, bSecond);
  return utcDate.getTime() - berlinTime;
}

function berlinTimeToUTC(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);

  let utcMs = targetMs;
  for (let i = 0; i < 3; i++) {
    const offset = getBerlinOffsetMs(new Date(utcMs));
    const newUtcMs = targetMs + offset;
    if (Math.abs(newUtcMs - utcMs) < 1000) {
      utcMs = newUtcMs;
      break;
    }
    utcMs = newUtcMs;
  }

  return new Date(utcMs);
}

function formatBerlinDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getBerlinDateFromUTC(date: Date): string {
  return formatBerlinDate(date);
}

function calculatePureAlcohol(volumeMl: number, abv: number): number {
  return volumeMl * (abv / 100) * 0.789;
}

function generateSessionCurve(
  db: Database.Database,
  sessionId: number,
  sessionStart: string,
  sessionEnd: string | null,
  profile: { weight_kg: number; height_cm: number; sex: string; age: number; preferred_formula: string | null },
  formula: BACFormula,
): { peakPromille: number; integralPromilleHours: number; durationHours: number } {
  const from = new Date(sessionStart);
  const to = sessionEnd ? new Date(sessionEnd) : nowUTC();
  const durationMs = to.getTime() - from.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours <= 0) {
    return { peakPromille: 0, integralPromilleHours: 0, durationHours: 0 };
  }

  const engineProfile = profileToEngine(profile);
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(sessionId) as DrinkData[];

  if (drinks.length === 0) {
    return { peakPromille: 0, integralPromilleHours: 0, durationHours };
  }

  const stepMinutes = 5;
  const totalMinutes = Math.ceil(durationMs / (1000 * 60));
  const sweetSpot = getSweetSpotDefaults();

  const curvePoints: number[] = [];
  for (let offset = 0; offset <= totalMinutes; offset += stepMinutes) {
    const pointTime = new Date(from.getTime() + offset * 60000);
    const engineDrinks = drinksToEngine(db, drinks, pointTime);
    const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, -offset);
    const bacPromille = bacPercent * 10;
    curvePoints.push(Math.round(bacPromille * 100) / 100);
  }

  let peakPromille = 0;
  let integralPromilleHours = 0;

  for (let i = 0; i < curvePoints.length; i++) {
    if (curvePoints[i]! > peakPromille) {
      peakPromille = curvePoints[i]!;
    }

    if (i < curvePoints.length - 1) {
      const avgBac = (curvePoints[i]! + curvePoints[i + 1]!) / 2;
      const deltaHours = stepMinutes / 60;
      integralPromilleHours += avgBac * deltaHours;
    }
  }

  return { peakPromille, integralPromilleHours, durationHours };
}

export function getStats(
  db: Database.Database,
  options: {
    month?: string;
    year?: string;
    from?: Date;
    to?: Date;
    all?: boolean;
    formula?: BACFormula;
  } = {},
): StatsResult {
  const now = nowUTC();
  let from: Date;
  let to: Date;
  let mode: string;

  if (options.all) {
    const firstDrink = db.prepare('SELECT MIN(started_at) as first FROM drinks').get() as { first: string } | undefined;
    from = firstDrink?.first ? new Date(firstDrink.first) : now;
    to = now;
    mode = 'all';
  } else if (options.month) {
    const [yearStr, monthStr] = options.month.split('-');
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    from = berlinTimeToUTC(year, month, 1, 0, 0, 0);
    const lastDay = new Date(year, month, 0).getDate();
    to = berlinTimeToUTC(year, month, lastDay, 23, 59, 59);
    mode = 'month';
  } else if (options.year) {
    const year = parseInt(options.year, 10);
    from = berlinTimeToUTC(year, 1, 1, 0, 0, 0);
    to = berlinTimeToUTC(year, 12, 31, 23, 59, 59);
    mode = 'year';
  } else if (options.from && options.to) {
    from = options.from;
    to = options.to;
    mode = 'range';
  } else {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    to = now;
    mode = 'rolling_30d';
  }

  const fromStr = formatISOUTC(from);
  const toStr = formatISOUTC(to);

  const drinks = db.prepare(
    'SELECT started_at, volume_ml, abv FROM drinks WHERE started_at >= ? AND started_at <= ?'
  ).all(fromStr, toStr) as Array<{ started_at: string; volume_ml: number; abv: number }>;

  const drinkingDays = new Set(drinks.map(d => getBerlinDateFromUTC(new Date(d.started_at)))).size;

  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const dryDays = rangeDays - drinkingDays;

  const sessions = db.prepare(
    'SELECT id, started_at, ended_at FROM sessions WHERE started_at >= ? AND started_at <= ?'
  ).all(fromStr, toStr) as Array<{ id: number; started_at: string; ended_at: string | null }>;

  const totalPureAlcohol = drinks.reduce((sum, d) => sum + calculatePureAlcohol(d.volume_ml, d.abv), 0);

  const presetStats = db.prepare(
    `SELECT
      COALESCE(preset_name, 'unknown') as name,
      COUNT(*) as count,
      SUM(volume_ml) as total_volume_ml,
      SUM(volume_ml * abv / 100 * 0.789) as total_pure_alcohol_g
     FROM drinks
     WHERE started_at >= ? AND started_at <= ?
     GROUP BY COALESCE(preset_name, 'unknown')`
  ).all(fromStr, toStr) as PresetStats[];

  const allDrinks = db.prepare('SELECT started_at FROM drinks ORDER BY started_at').all() as Array<{ started_at: string }>;
  const allDrinkingDays = [...new Set(allDrinks.map(d => getBerlinDateFromUTC(new Date(d.started_at))))].sort();

  let longestDryStreak = 0;
  let currentDryStreak = 0;

  if (allDrinkingDays.length > 0) {
    for (let i = 1; i < allDrinkingDays.length; i++) {
      const prev = new Date(allDrinkingDays[i - 1]!);
      const curr = new Date(allDrinkingDays[i]!);
      const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      const streak = Math.floor(diff) - 1;
      if (streak > longestDryStreak) {
        longestDryStreak = streak;
      }
    }

    const lastDrinkingDay = new Date(allDrinkingDays[allDrinkingDays.length - 1]!);
    const today = new Date();
    const daysSinceLastDrink = Math.floor((today.getTime() - lastDrinkingDay.getTime()) / (24 * 60 * 60 * 1000));
    currentDryStreak = daysSinceLastDrink;
  }

  // Calculate BAC metrics per session
  let avgPeakPromille = 0;
  let avgSessionPromille = 0;
  let maxSessionPromille = 0;

  if (sessions.length > 0) {
    const profile = requireProfile(db, 'stats');
    const formula = resolveFormula(
      profile.preferred_formula as BACFormula | undefined,
      options.formula,
    );

    let totalIntegral = 0;
    let totalDuration = 0;
    let peakSum = 0;
    let maxPeak = 0;

    for (const session of sessions) {
      const curve = generateSessionCurve(
        db,
        session.id,
        session.started_at,
        session.ended_at,
        profile,
        formula,
      );

      if (curve.durationHours > 0) {
        totalIntegral += curve.integralPromilleHours;
        totalDuration += curve.durationHours;
        peakSum += curve.peakPromille;
        if (curve.peakPromille > maxPeak) {
          maxPeak = curve.peakPromille;
        }
      }
    }

    if (sessions.length > 0) {
      avgPeakPromille = Math.round((peakSum / sessions.length) * 100) / 100;
    }
    if (totalDuration > 0) {
      avgSessionPromille = Math.round((totalIntegral / totalDuration) * 100) / 100;
    }
    maxSessionPromille = Math.round(maxPeak * 100) / 100;
  }

  return {
    period: {
      from: formatBerlinDate(from),
      to: formatBerlinDate(to),
      mode,
    },
    drinking_days: drinkingDays,
    dry_days: dryDays,
    longest_dry_streak: longestDryStreak,
    current_dry_streak: currentDryStreak,
    total_drinks: drinks.length,
    total_sessions: sessions.length,
    total_pure_alcohol_g: Math.round(totalPureAlcohol * 100) / 100,
    avg_peak_promille: avgPeakPromille,
    avg_session_promille: avgSessionPromille,
    max_session_promille: maxSessionPromille,
    by_preset: presetStats.map(p => ({
      ...p,
      total_pure_alcohol_g: Math.round(p.total_pure_alcohol_g * 100) / 100,
    })),
  };
}
