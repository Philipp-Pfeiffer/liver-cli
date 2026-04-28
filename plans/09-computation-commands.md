# Phase 9: Computation Commands

## Ziel
BAC-Berechnung, Status, Curve, Sober implementieren.

## Schritt 9.1: Computation-Utilities implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/compute.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { ProfileParams, DrinkInput, BACFormula } from '../engine/types.js';
import { calculateBACAtOffset, getMinutesUntilSober, getCurve, resolveFormula } from '../engine/index.js';
import { requireProfile } from './profile.js';
import { requireActiveSession, getActiveSession, resolveStomachStateAt } from './session.js';
import { getSweetSpotDefaults } from '../config/index.js';
import { formatISOUTC, formatISOLocal, nowUTC, minutesBetween } from '../time/index.js';
import type { DrinkData } from './drink.js';

function profileToEngine(profile: { weight_kg: number; height_cm: number; sex: string; age: number }): ProfileParams {
  return {
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    sex: profile.sex === 'f' ? 'female' : 'male',
    age: profile.age,
  };
}

function drinksToEngine(
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
      abv: drink.abv / 100, // Convert percent to fraction
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
  options: { formula?: BACFormula } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'status');
  const session = getActiveSession(db);
  
  if (!session) {
    throw new Error('SESSION_NOT_ACTIVE');
  }
  
  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );
  
  const engineProfile = profileToEngine(profile);
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];
  
  const now = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, now);
  
  const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
  const bacPromille = bacPercent * 10;
  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const soberAt = new Date(now.getTime() + minutesUntil * 60000);
  
  const sweetSpot = getSweetSpotDefaults();
  const zone = getZone(bacPromille, sweetSpot.min, sweetSpot.max);
  
  // Determine trajectory
  const bacFuture = calculateBACAtOffset(engineProfile, engineDrinks, formula, -5);
  const trajectory = bacFuture > bacPercent ? 'rising' : 'falling';
  
  // Count absorbing drinks (drinks that haven't finished yet)
  const absorbingDrinks = drinks.filter(d => !d.finished_at).length;
  
  return {
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
  
  // Find session for this timestamp
  const session = db.prepare(
    `SELECT * FROM sessions 
     WHERE started_at <= ? 
     AND (ended_at IS NULL OR ended_at >= ?)
     ORDER BY started_at DESC
     LIMIT 1`
  ).get(formatISOUTC(at), formatISOUTC(at)) as { id: number } | undefined;
  
  if (!session) {
    throw new Error('SESSION_NOT_ACTIVE');
  }
  
  const engineProfile = profileToEngine(profile);
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];
  
  const engineDrinks = drinksToEngine(db, drinks, at);
  const offsetMinutes = -minutesBetween(at, nowUTC());
  const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, offsetMinutes);
  const bacPromille = bacPercent * 10;
  
  const sweetSpot = getSweetSpotDefaults();
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
  options: { formula?: BACFormula } = {},
): Record<string, unknown> {
  const profile = requireProfile(db, 'sober');
  const session = getActiveSession(db);
  
  if (!session) {
    throw new Error('SESSION_NOT_ACTIVE');
  }
  
  const formula = resolveFormula(
    profile.preferred_formula as BACFormula | undefined,
    options.formula,
  );
  
  const engineProfile = profileToEngine(profile);
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];
  
  const now = nowUTC();
  const engineDrinks = drinksToEngine(db, drinks, now);
  
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
    throw new Error('SESSION_NOT_ACTIVE');
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
  
  // Check curve size
  const totalMinutes = (to.getTime() - from.getTime()) / 60000;
  const points = Math.ceil(totalMinutes / stepMinutes) + 1;
  
  if (points > 1000) {
    const suggestedStep = Math.ceil(totalMinutes / 1000);
    // Round to nearest standard step
    const standardSteps = [1, 5, 10, 30, 60];
    const roundedStep = standardSteps.find(s => s >= suggestedStep) ?? suggestedStep;
    throw new Error(`CURVE_TOO_LARGE:${roundedStep}`);
  }
  
  const engineProfile = profileToEngine(profile);
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];
  
  const sweetSpot = getSweetSpotDefaults();
  
  const curvePoints = [];
  for (let offset = 0; offset <= totalMinutes; offset += stepMinutes) {
    const pointTime = new Date(from.getTime() + offset * 60000);
    const engineDrinks = drinksToEngine(db, drinks, pointTime);
    const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, -offset);
    const bacPromille = bacPercent * 10;
    
    curvePoints.push({
      at: formatISOLocal(pointTime),
      bac_promille: Math.round(bacPromille * 100) / 100,
      zone: getZone(bacPromille, sweetSpot.min, sweetSpot.max),
    });
  }
  
  return {
    curve: curvePoints,
    meta: {
      from: formatISOLocal(from),
      to: formatISOLocal(to),
      step_min: stepMinutes,
      points: curvePoints.length,
      formula,
    },
  };
}
```

## Schritt 9.2: Auto-Close Logic

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/auto-close.ts`:

```typescript
import type Database from 'better-sqlite3';
import { getActiveSession } from './session.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { getMinutesUntilSober } from '../engine/index.js';
import { formatISOUTC } from '../time/index.js';
import type { BACFormula } from '../engine/types.js';

export function performAutoClose(db: Database.Database): number | null {
  const session = getActiveSession(db);
  if (!session) return null;
  
  const profile = requireProfile(db, 'auto-close');
  
  const lastDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY finished_at DESC LIMIT 1'
  ).get(session.id) as { finished_at: string | null } | undefined;
  
  if (!lastDrink || !lastDrink.finished_at) return null;
  
  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = {
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    sex: profile.sex === 'f' ? 'female' : 'male',
    age: profile.age,
  };
  
  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as Array<{ volume_ml: number; abv: number; started_at: string; finished_at: string | null }>;
  
  const now = new Date();
  const engineDrinks = drinks.map(d => {
    const startedAt = new Date(d.started_at);
    const finishedAt = d.finished_at ? new Date(d.finished_at) : now;
    return {
      volumeMl: d.volume_ml,
      abv: d.abv / 100,
      durationMinutes: (finishedAt.getTime() - startedAt.getTime()) / 60000,
      startedAtMinutesAgo: (now.getTime() - startedAt.getTime()) / 60000,
      stomachFullness: 'some' as const, // Simplified
    };
  });
  
  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const lastFinishedAt = new Date(lastDrink.finished_at);
  const soberAt = new Date(lastFinishedAt.getTime() + minutesUntil * 60000);
  
  if (now >= soberAt) {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
      formatISOUTC(soberAt),
      session.id,
    );
    return session.id;
  }
  
  return null;
}
```

## Schritt 9.3: Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/compute.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getStatus, getBACAt, getSober } from '../../src/commands/compute.js';

describe('computation commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
    startSession(db, { stomach: 'full' });
  });
  
  it('should calculate status after drink', () => {
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    const status = getStatus(db);
    
    expect(status.bac_promille).toBeGreaterThan(0);
    expect(status.minutes_until_sober).toBeGreaterThan(0);
    expect(status.drinks_in_session).toBe(1);
    expect(status.disclaimer).toBeDefined();
  });
  
  it('should calculate BAC at specific time', () => {
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    const now = new Date();
    const result = getBACAt(db, now);
    
    expect(result.bac_promille).toBeGreaterThan(0);
    expect(result.zone).toBeDefined();
    expect(result.formula).toBe('watson');
  });
  
  it('should calculate sober time', () => {
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    const result = getSober(db);
    
    expect(result.minutes_until_sober).toBeGreaterThan(0);
    expect(result.sober_at).toBeDefined();
    expect(result.disclaimer).toBeDefined();
  });
  
  it('should require profile', () => {
    const db2 = new Database(':memory:');
    migrate(db2);
    expect(() => getStatus(db2)).toThrow();
  });
  
  it('should require active session', () => {
    const db2 = new Database(':memory:');
    migrate(db2);
    setProfile(db2, 78, 184, 'm', 22);
    expect(() => getStatus(db2)).toThrow();
  });
});
```

## Schritt 9.4: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] `status` gibt BAC, Trajectory, Zone, Sober-Zeit zurück
- [ ] `bac --at` berechnet BAC zu einem Zeitpunkt
- [ ] `sober` gibt Minuten bis nüchtern und Zeitpunkt zurück
- [ ] `curve` generiert BAC-Verlauf mit max. 1000 Punkten
- [ ] Formula-Override funktioniert
- [ ] Auto-Close schließt Sessions wenn sober-Zeit erreicht
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 10: Stats Command** (`10-stats-command.md`)
