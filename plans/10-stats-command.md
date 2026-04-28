# Phase 10: Stats Command

## Ziel
Stats-Aggregation über Zeitperioden implementieren.

## Schritt 10.1: Stats Command implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/stats.ts`:

```typescript
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
  // Format as YYYY-MM-DD in Berlin timezone
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
    // Default: rolling 30 days
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    to = now;
    mode = 'rolling_30d';
  }
  
  const fromStr = formatISOUTC(from);
  const toStr = formatISOUTC(to);
  
  // Count drinking days (Berlin timezone)
  const drinks = db.prepare(
    'SELECT started_at, volume_ml, abv FROM drinks WHERE started_at >= ? AND started_at <= ?'
  ).all(fromStr, toStr) as Array<{ started_at: string; volume_ml: number; abv: number }>;
  
  const drinkingDays = new Set(drinks.map(d => getBerlinDate(new Date(d.started_at)))).size;
  
  // Count range days
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const dryDays = rangeDays - drinkingDays;
  
  // Sessions in range
  const sessions = db.prepare(
    'SELECT id, started_at FROM sessions WHERE started_at >= ? AND started_at <= ?'
  ).all(fromStr, toStr) as Array<{ id: number; started_at: string }>;
  
  // Total pure alcohol
  const totalPureAlcohol = drinks.reduce((sum, d) => sum + calculatePureAlcohol(d.volume_ml, d.abv), 0);
  
  // Preset stats
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
  
  // Calculate streaks
  const allDrinks = db.prepare('SELECT started_at FROM drinks ORDER BY started_at').all() as Array<{ started_at: string }>;
  const allDrinkingDays = [...new Set(allDrinks.map(d => getBerlinDate(new Date(d.started_at))))].sort();
  
  let longestDryStreak = 0;
  let currentDryStreak = 0;
  
  if (allDrinkingDays.length > 0) {
    // Calculate longest dry streak
    for (let i = 1; i < allDrinkingDays.length; i++) {
      const prev = new Date(allDrinkingDays[i - 1]!);
      const curr = new Date(allDrinkingDays[i]!);
      const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      const streak = Math.floor(diff) - 1;
      if (streak > longestDryStreak) {
        longestDryStreak = streak;
      }
    }
    
    // Calculate current dry streak
    const lastDrinkingDay = new Date(allDrinkingDays[allDrinkingDays.length - 1]!);
    const today = new Date();
    const daysSinceLastDrink = Math.floor((today.getTime() - lastDrinkingDay.getTime()) / (24 * 60 * 60 * 1000));
    currentDryStreak = daysSinceLastDrink;
  }
  
  // Note: avg_peak_promille, avg_session_promille, max_session_promille
  // require curve generation per session. For v0.x, we'll use simplified values.
  // Full implementation would call engine for each session's peak.
  
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
    avg_peak_promille: 0, // TODO: Implement with curve generation
    avg_session_promille: 0,
    max_session_promille: 0,
    by_preset: presetStats.map(p => ({
      ...p,
      total_pure_alcohol_g: Math.round(p.total_pure_alcohol_g * 100) / 100,
    })),
  };
}
```

## Schritt 10.2: Stats Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/stats.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, endSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getStats } from '../../src/commands/stats.js';

describe('stats command', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });
  
  it('should return stats for default period', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    endSession(db);
    
    const stats = getStats(db);
    expect(stats.total_drinks).toBe(1);
    expect(stats.total_sessions).toBe(1);
    expect(stats.drinking_days).toBe(1);
    expect(stats.period.mode).toBe('rolling_30d');
  });
  
  it('should return zero stats for empty range', () => {
    const stats = getStats(db);
    expect(stats.total_drinks).toBe(0);
    expect(stats.total_sessions).toBe(0);
    expect(stats.drinking_days).toBe(0);
    expect(stats.by_preset).toEqual([]);
  });
  
  it('should calculate pure alcohol correctly', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    const stats = getStats(db);
    // 500 * 0.052 * 0.789 = 20.514
    expect(stats.total_pure_alcohol_g).toBeCloseTo(20.51, 1);
  });
  
  it('should aggregate by preset', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2, presetName: 'augustiner' });
    addDrink(db, { volumeMl: 500, abv: 5.2, presetName: 'augustiner' });
    
    const stats = getStats(db);
    expect(stats.by_preset.length).toBe(1);
    expect(stats.by_preset[0]?.count).toBe(2);
    expect(stats.by_preset[0]?.name).toBe('augustiner');
  });
});
```

## Schritt 10.3: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Stats werden für verschiedene Perioden berechnet
- [ ] Default-Periode ist rolling_30d
- [ ] Drinking Days werden korrekt gezählt
- [ ] Pure Alcohol wird korrekt berechnet
- [ ] Preset-Aggregation funktioniert
- [ ] Empty Range gibt Erfolg mit Nullen zurück
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 11: Output Formatting** (`11-output-formatting.md`)
