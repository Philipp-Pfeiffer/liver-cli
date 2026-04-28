import type Database from 'better-sqlite3';
import { formatISOUTC, nowUTC } from '../time/index.js';
import type { BACFormula } from '../engine/types.js';
import { resolveFormula } from '../engine/index.js';
import { requireProfile } from './profile.js';

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

function getBerlinDate(date: Date): string {
  const berlinDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  return berlinDate.toISOString().split('T')[0]!;
}

function calculatePureAlcohol(volumeMl: number, abv: number): number {
  return volumeMl * (abv / 100) * 0.789;
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
    from = new Date(`${options.month}-01T00:00:00`);
    to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
    mode = 'month';
  } else if (options.year) {
    from = new Date(`${options.year}-01-01T00:00:00`);
    to = new Date(`${options.year}-12-31T23:59:59`);
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
  
  const drinkingDays = new Set(drinks.map(d => getBerlinDate(new Date(d.started_at)))).size;
  
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const dryDays = rangeDays - drinkingDays;
  
  const sessions = db.prepare(
    'SELECT id, started_at FROM sessions WHERE started_at >= ? AND started_at <= ?'
  ).all(fromStr, toStr) as Array<{ id: number; started_at: string }>;
  
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
  const allDrinkingDays = [...new Set(allDrinks.map(d => getBerlinDate(new Date(d.started_at))))].sort();
  
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
  
  return {
    period: {
      from: from.toISOString().split('T')[0]!,
      to: to.toISOString().split('T')[0]!,
      mode,
    },
    drinking_days: drinkingDays,
    dry_days: dryDays,
    longest_dry_streak: longestDryStreak,
    current_dry_streak: currentDryStreak,
    total_drinks: drinks.length,
    total_sessions: sessions.length,
    total_pure_alcohol_g: Math.round(totalPureAlcohol * 100) / 100,
    avg_peak_promille: 0,
    avg_session_promille: 0,
    max_session_promille: 0,
    by_preset: presetStats.map(p => ({
      ...p,
      total_pure_alcohol_g: Math.round(p.total_pure_alcohol_g * 100) / 100,
    })),
  };
}