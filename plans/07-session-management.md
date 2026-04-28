# Phase 7: Session Management

## Ziel
Session-Lifecycle implementieren: start, end, list, show, stomach events, auto-close.

## Schritt 7.1: Session Commands implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/session.ts`:

```typescript
import type Database from 'better-sqlite3';
import { validateSessionName, validateStomachState } from '../errors/validation.js';
import {
  SESSION_ALREADY_ACTIVE,
  SESSION_NOT_ACTIVE,
  TIMESTAMP_OUTSIDE_SESSION,
} from '../errors/index.js';
import { formatISOUTC, nowUTC, parseTimestamp } from '../time/index.js';

export interface SessionData {
  id: number;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  stomach_initial: string;
}

export interface StomachEvent {
  id: number;
  session_id: number;
  at: string;
  state: string;
}

export function getActiveSession(db: Database.Database): SessionData | null {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  ).get() as SessionData | undefined;
  
  return session ?? null;
}

export function requireActiveSession(db: Database.Database): SessionData {
  const session = getActiveSession(db);
  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }
  return session;
}

export function startSession(
  db: Database.Database,
  options: {
    name?: string;
    stomach?: string;
    at?: Date;
    force?: boolean;
  },
): { ok: true; session_id: number } {
  validateSessionName(options.name);
  
  const stomachState = options.stomach ?? 'some';
  validateStomachState(stomachState);
  
  const activeSession = getActiveSession(db);
  if (activeSession && !options.force) {
    throw SESSION_ALREADY_ACTIVE();
  }
  
  const at = options.at ?? nowUTC();
  
  // Transaction: close old + open new if force
  db.transaction(() => {
    if (activeSession && options.force) {
      db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
        formatISOUTC(at),
        activeSession.id,
      );
    }
    
    const result = db.prepare(
      'INSERT INTO sessions (name, started_at, ended_at, stomach_initial) VALUES (?, ?, ?, ?)'
    ).run(
      options.name ?? null,
      formatISOUTC(at),
      null,
      stomachState,
    );
    
    const sessionId = result.lastInsertRowid as number;
    
    // Create initial stomach event
    db.prepare(
      'INSERT INTO stomach_events (session_id, at, state) VALUES (?, ?, ?)'
    ).run(sessionId, formatISOUTC(at), stomachState);
  })();
  
  const newSession = getActiveSession(db);
  if (!newSession) {
    throw new Error('Failed to create session');
  }
  
  return { ok: true, session_id: newSession.id };
}

export function endSession(
  db: Database.Database,
  options: { at?: Date } = {},
): { ok: true; session_id: number } {
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
    formatISOUTC(at),
    session.id,
  );
  
  return { ok: true, session_id: session.id };
}

export function getSession(db: Database.Database, id: number): SessionData | null {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionData | null;
}

export function listSessions(
  db: Database.Database,
  options: { year?: string; month?: string } = {},
): { items: SessionData[]; count: number } {
  let sql = 'SELECT * FROM sessions WHERE 1=1';
  const params: unknown[] = [];
  
  if (options.month) {
    sql += ' AND started_at LIKE ?';
    params.push(`${options.month}%`);
  } else if (options.year) {
    sql += ' AND started_at LIKE ?';
    params.push(`${options.year}%`);
  }
  
  sql += ' ORDER BY started_at DESC';
  
  const items = db.prepare(sql).all(...params) as SessionData[];
  return { items, count: items.length };
}

export function setStomachState(
  db: Database.Database,
  state: string,
  options: { at?: Date } = {},
): { ok: true; session_id: number } {
  validateStomachState(state);
  
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  
  // Check if timestamp is within session bounds
  const sessionStart = new Date(session.started_at);
  if (at < sessionStart) {
    throw TIMESTAMP_OUTSIDE_SESSION();
  }
  
  // If session has ended, check against ended_at
  if (session.ended_at) {
    const sessionEnd = new Date(session.ended_at);
    if (at > sessionEnd) {
      throw TIMESTAMP_OUTSIDE_SESSION();
    }
  }
  
  db.prepare(
    'INSERT INTO stomach_events (session_id, at, state) VALUES (?, ?, ?)'
  ).run(session.id, formatISOUTC(at), state);
  
  return { ok: true, session_id: session.id };
}

export function resolveStomachStateAt(
  db: Database.Database,
  sessionId: number,
  at: Date,
): string {
  const event = db.prepare(
    `SELECT state FROM stomach_events
     WHERE session_id = ? AND at <= ?
     ORDER BY at DESC, rowid DESC
     LIMIT 1`
  ).get(sessionId, formatISOUTC(at)) as { state: string } | undefined;
  
  if (event) {
    return event.state;
  }
  
  const session = db.prepare(
    'SELECT stomach_initial FROM sessions WHERE id = ?'
  ).get(sessionId) as { stomach_initial: string } | undefined;
  
  return session?.stomach_initial ?? 'some';
}

export function autoCloseSession(db: Database.Database): number | null {
  const session = getActiveSession(db);
  if (!session) return null;
  
  const lastDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY finished_at DESC LIMIT 1'
  ).get(session.id) as { finished_at: string } | undefined;
  
  if (!lastDrink) return null;
  
  // Note: Real implementation needs engine calculation
  // For now, we'll return null to keep session open
  // Full implementation in Phase 9
  return null;
}
```

## Schritt 7.2: Session Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/session.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import {
  startSession,
  endSession,
  getActiveSession,
  requireActiveSession,
  setStomachState,
  resolveStomachStateAt,
  listSessions,
} from '../../src/commands/session.js';

describe('session commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should start a session', () => {
    const result = startSession(db, { name: 'Test', stomach: 'full' });
    expect(result.session_id).toBeGreaterThan(0);
    
    const session = getActiveSession(db);
    expect(session).not.toBeNull();
    expect(session?.name).toBe('Test');
    expect(session?.stomach_initial).toBe('full');
  });
  
  it('should create initial stomach event', () => {
    startSession(db, { stomach: 'full' });
    const session = getActiveSession(db);
    
    const events = db.prepare('SELECT * FROM stomach_events WHERE session_id = ?').all(session!.id);
    expect(events.length).toBe(1);
    expect((events[0] as { state: string }).state).toBe('full');
  });
  
  it('should reject duplicate active session', () => {
    startSession(db, {});
    expect(() => startSession(db, {})).toThrow();
  });
  
  it('should allow force override', () => {
    startSession(db, {});
    const result = startSession(db, { force: true });
    expect(result.session_id).toBeGreaterThan(0);
  });
  
  it('should end session', () => {
    startSession(db, {});
    const result = endSession(db);
    expect(result.ok).toBe(true);
    expect(getActiveSession(db)).toBeNull();
  });
  
  it('should reject end without active session', () => {
    expect(() => endSession(db)).toThrow();
  });
  
  it('should set stomach state', () => {
    startSession(db, { stomach: 'full' });
    const result = setStomachState(db, 'some');
    expect(result.ok).toBe(true);
    
    const events = db.prepare('SELECT * FROM stomach_events').all();
    expect(events.length).toBe(2);
  });
  
  it('should resolve stomach state at time', () => {
    const now = new Date();
    startSession(db, { stomach: 'full', at: now });
    const session = getActiveSession(db);
    
    const state = resolveStomachStateAt(db, session!.id, now);
    expect(state).toBe('full');
  });
  
  it('should resolve historical stomach state', () => {
    const now = new Date();
    startSession(db, { stomach: 'full', at: now });
    const session = getActiveSession(db);
    
    // Add stomach event in the future
    const future = new Date(now.getTime() + 3600000);
    setStomachState(db, 'some', { at: future });
    
    // Query before the event
    const past = new Date(now.getTime() + 1800000);
    const state = resolveStomachStateAt(db, session!.id, past);
    expect(state).toBe('full');
    
    // Query after the event
    const later = new Date(now.getTime() + 7200000);
    const stateLater = resolveStomachStateAt(db, session!.id, later);
    expect(stateLater).toBe('some');
  });
  
  it('should reject stomach state outside session', () => {
    const now = new Date();
    startSession(db, { at: now });
    
    const past = new Date(now.getTime() - 3600000);
    expect(() => setStomachState(db, 'empty', { at: past })).toThrow();
  });
  
  it('should list sessions', () => {
    startSession(db, { name: 'Session 1' });
    endSession(db);
    startSession(db, { name: 'Session 2' });
    
    const list = listSessions(db);
    expect(list.count).toBe(2);
  });
});
```

## Schritt 7.3: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Sessions können gestartet und beendet werden
- [ ] Nur eine aktive Session zur gleichen Zeit
- [ ] `--force` beendet alte Session und startet neue
- [ ] Initialer Stomach-Event wird bei Session-Start erstellt
- [ ] Stomach-State kann gewechselt werden
- [ ] Stomach-State-Resolver funktioniert historisch korrekt
- [ ] Stomach-Events außerhalb der Session werfen Fehler
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 8: Drink Management** (`08-drink-management.md`)
