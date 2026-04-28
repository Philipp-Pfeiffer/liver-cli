# Phase 8: Drink Management

## Ziel
Drink-Commands implementieren: add, start, stop, list, rm. Stomach-State-Resolver integrieren.

## Schritt 8.1: Drink Commands implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/drink.ts`:

```typescript
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

export function addDrink(
  db: Database.Database,
  options: {
    volumeMl: number;
    abv: number;
    at?: Date;
    duration?: string;
    presetName?: string;
  },
): { drink_id: number; session_id: number; started_at: string; finished_at: string; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const at = options.at ?? nowUTC();
  const durationMinutes = options.duration ? parseDuration(options.duration) : 0;
  validateDuration(durationMinutes);
  
  // Find session for this timestamp
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
  
  return {
    drink_id: result.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    finished_at: formatISOUTC(finishedAt),
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
  };
}

export function startDrink(
  db: Database.Database,
  options: {
    volumeMl: number;
    abv: number;
    presetName?: string;
  },
): { drink_id: number; session_id: number; started_at: string; volume_ml: number; abv: number; preset_name: string | null; stomach_state: string } {
  validateVolume(options.volumeMl);
  validateABV(options.abv);
  
  const session = requireActiveSession(db);
  const at = nowUTC();
  
  // Check if there's already a running drink
  const runningDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NULL'
  ).get(session.id) as DrinkData | undefined;
  
  if (runningDrink) {
    throw DRINK_ALREADY_RUNNING();
  }
  
  const stomachState = resolveStomachStateAt(db, session.id, at);
  
  const result = db.prepare(
    'INSERT INTO drinks (session_id, started_at, finished_at, volume_ml, abv, preset_name) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    session.id,
    formatISOUTC(at),
    null,
    options.volumeMl,
    options.abv,
    options.presetName ?? null,
  );
  
  return {
    drink_id: result.lastInsertRowid as number,
    session_id: session.id,
    started_at: formatISOUTC(at),
    volume_ml: options.volumeMl,
    abv: options.abv,
    preset_name: options.presetName ?? null,
    stomach_state: stomachState,
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
```

## Schritt 8.2: Drink Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/drink.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import {
  addDrink,
  startDrink,
  stopDrink,
  listDrinks,
  removeDrink,
  getRunningDrink,
} from '../../src/commands/drink.js';

describe('drink commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });
  
  it('should add drink to active session', () => {
    startSession(db, { stomach: 'full' });
    const result = addDrink(db, { volumeMl: 500, abv: 5.2, presetName: 'augustiner' });
    
    expect(result.drink_id).toBeGreaterThan(0);
    expect(result.volume_ml).toBe(500);
    expect(result.abv).toBe(5.2);
    expect(result.stomach_state).toBe('full');
  });
  
  it('should reject drink outside session', () => {
    startSession(db, {});
    const past = new Date(Date.now() - 86400000);
    expect(() => addDrink(db, { volumeMl: 500, abv: 5.2, at: past })).toThrow();
  });
  
  it('should start and stop drink', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 40, abv: 40 });
    expect(startResult.drink_id).toBeGreaterThan(0);
    
    const running = getRunningDrink(db);
    expect(running).not.toBeNull();
    
    const stopResult = stopDrink(db);
    expect(stopResult.drink_id).toBe(startResult.drink_id);
    expect(stopResult.duration_secs).toBeGreaterThanOrEqual(0);
    
    const afterStop = getRunningDrink(db);
    expect(afterStop).toBeNull();
  });
  
  it('should reject second start without stop', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2 });
    expect(() => startDrink(db, { volumeMl: 500, abv: 5.2 })).toThrow();
  });
  
  it('should reject stop without running drink', () => {
    startSession(db, {});
    expect(() => stopDrink(db)).toThrow();
  });
  
  it('should list drinks', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    const list = listDrinks(db);
    expect(list.count).toBe(2);
  });
  
  it('should remove drink', () => {
    startSession(db, {});
    const result = addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    removeDrink(db, result.drink_id);
    const list = listDrinks(db);
    expect(list.count).toBe(0);
  });
  
  it('should reject removing unknown drink', () => {
    expect(() => removeDrink(db, 999)).toThrow();
  });
  
  it('should respect drink duration', () => {
    startSession(db, {});
    const result = addDrink(db, { volumeMl: 500, abv: 5.2, duration: '25m' });
    
    const startedAt = new Date(result.started_at);
    const finishedAt = new Date(result.finished_at);
    const diff = (finishedAt.getTime() - startedAt.getTime()) / 60000;
    expect(diff).toBe(25);
  });
});
```

## Schritt 8.3: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Drinks können zu aktiver Session hinzugefügt werden
- [ ] Drinks erben korrekten Stomach-State
- [ ] Drinks außerhalb der Session werden abgelehnt
- [ ] `start` erstellt laufenden Drink (finished_at = NULL)
- [ ] `stop` beendet laufenden Drink
- [ ] Zweiter `start` ohne `stop` wirft Fehler
- [ ] Drinks können gelistet und gelöscht werden
- [ ] Duration wird korrekt in finished_at umgerechnet
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 9: Computation Commands** (`09-computation-commands.md`)
