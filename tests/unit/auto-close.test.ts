import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, getActiveSession } from '../../src/commands/session.js';
import { startDrink, stopDrink, addDrink } from '../../src/commands/drink.js';
import { getStatus } from '../../src/commands/compute.js';
import { setConfig } from '../../src/config/index.js';

describe('auto-close', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('should not auto-close drink within grace period', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.0, duration: '1m' });

    // Immediately after drink ends, still within default 15min grace
    const status = getStatus(db);
    expect(status.auto_closed_drinks).toBeUndefined();
  });

  it('should auto-close drink after grace period', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 500, abv: 5.0, duration: '1m' });

    // 20 minutes after drink started (1min duration + 15min grace + 4min buffer)
    const future = new Date(Date.now() + 20 * 60000);
    const status = getStatus(db, { at: future });

    expect(status.auto_closed_drinks).toBeDefined();
    expect(Array.isArray(status.auto_closed_drinks)).toBe(true);
    expect((status.auto_closed_drinks as Array<unknown>).length).toBe(1);
    expect((status.auto_closed_drinks as Array<{ drink_id: number }>)[0].drink_id).toBe(startResult.drink_id);
  });

  it('should respect custom auto_close_grace_minutes', () => {
    setConfig('auto_close_grace_minutes', 5, db);

    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 500, abv: 5.0, duration: '1m' });

    // 10 minutes after drink started (1min duration + 5min grace + 4min buffer)
    const future = new Date(Date.now() + 10 * 60000);
    const status = getStatus(db, { at: future });

    expect(status.auto_closed_drinks).toBeDefined();
    expect(Array.isArray(status.auto_closed_drinks)).toBe(true);
    expect((status.auto_closed_drinks as Array<unknown>).length).toBe(1);
  });

  it('should not auto-close when an open drink exists', () => {
    startSession(db, {});
    // First add an instant (closed) drink
    addDrink(db, { volumeMl: 500, abv: 5.0 });

    // Then start an open drink (no duration)
    startDrink(db, { volumeMl: 500, abv: 5.0 });

    // Far in the future — session should NOT be auto-closed because there's an open drink
    const farFuture = new Date(Date.now() + 24 * 60 * 60000);
    const status = getStatus(db, { at: farFuture });

    // Session should still be active
    expect(status.session_id).toBeDefined();

    // Verify the session was not ended by auto-close
    const session = getActiveSession(db);
    expect(session).not.toBeNull();
    expect(session!.ended_at).toBeNull();
  });
});
