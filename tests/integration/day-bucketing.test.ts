import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, endSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getStats } from '../../src/commands/stats.js';

describe('Day Bucketing Test', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('should bucket drinks by Berlin midnight', () => {
    // April 28, 2026 22:30 UTC = April 29, 2026 00:30 Berlin (DST, UTC+2)
    // This drink should count for April 29 in Berlin time
    const lateNightUTC = new Date('2026-04-28T22:30:00Z');
    
    // April 28, 2026 10:00 UTC = April 28, 2026 12:00 Berlin
    // This drink should count for April 28 in Berlin time
    const middayUTC = new Date('2026-04-28T10:00:00Z');

    startSession(db, { at: middayUTC });
    addDrink(db, { volumeMl: 500, abv: 5.0, at: middayUTC });
    addDrink(db, { volumeMl: 500, abv: 5.0, at: lateNightUTC });
    endSession(db, { at: lateNightUTC });

    const stats = getStats(db, { month: '2026-04' });
    
    // midday drink = April 28 in Berlin
    // late night drink (22:30 UTC = 00:30 Berlin next day) = April 29 in Berlin
    // Both are in April range when using Berlin boundaries
    expect(stats.drinking_days).toBe(2);
    expect(stats.total_drinks).toBe(2);
    
    // Query May - neither drink should be there
    const mayStats = getStats(db, { month: '2026-05' });
    expect(mayStats.drinking_days).toBe(0);
    expect(mayStats.total_drinks).toBe(0);
  });
});
