import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { performAutoClose } from '../../src/commands/auto-close.js';
import { getActiveSession } from '../../src/commands/session.js';

describe('Auto-Close Integration Test', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  afterEach(() => {
    db.close();
    vi.useRealTimers();
  });

  it('should auto-close session when sober time has passed', () => {
    // Set a fixed "now" time
    const baseTime = new Date('2026-04-28T19:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    startSession(db, { stomach: 'full' });
    addDrink(db, { volumeMl: 40, abv: 40 });
    
    // Session should still be active immediately after drink
    expect(getActiveSession(db)).not.toBeNull();
    
    // Advance time by 2 hours - should be past sober time for a small drink
    const futureTime = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000);
    vi.setSystemTime(futureTime);
    
    // Auto-close should detect that sober time has passed
    const closedSessionId = performAutoClose(db);
    
    expect(closedSessionId).not.toBeNull();
    expect(typeof closedSessionId).toBe('number');
    
    // Session should now be closed
    const session = getActiveSession(db);
    expect(session).toBeNull();
    
    // Verify the session has ended_at set
    const allSessions = db.prepare('SELECT * FROM sessions').all() as Array<{ id: number; ended_at: string | null }>;
    expect(allSessions.length).toBe(1);
    expect(allSessions[0]!.ended_at).not.toBeNull();
  });

  it('should not auto-close session before sober time', () => {
    const baseTime = new Date('2026-04-28T19:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    startSession(db, { stomach: 'full' });
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    // Immediately after drink, should NOT auto-close
    const closedSessionId = performAutoClose(db);
    expect(closedSessionId).toBeNull();
    
    // Session should still be active
    expect(getActiveSession(db)).not.toBeNull();
  });
});
