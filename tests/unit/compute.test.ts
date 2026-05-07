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
  });

  it('should calculate status after drink', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    const status = getStatus(db);

    expect(status.bac_promille).toBeGreaterThan(0);
    expect(status.minutes_until_sober).toBeGreaterThan(0);
    expect(status.drinks_in_session).toBe(1);
    expect(status.disclaimer).toBeDefined();
  });

  it('should calculate BAC at specific time', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    const now = new Date();
    // Query 30min in the future so ka-model has absorbed alcohol
    const result = getBACAt(db, new Date(now.getTime() + 30 * 60000));

    expect(result.bac_promille).toBeGreaterThan(0);
    expect(result.zone).toBeDefined();
    expect(result.formula).toBe('watson');
  });

  it('should calculate sober time', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
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

  it('should return no-session status when no active session', () => {
    const db2 = new Database(':memory:');
    migrate(db2);
    setProfile(db2, 78, 184, 'm', 22);
    const status = getStatus(db2);
    expect(status.session_id).toBeNull();
    expect(status.bac_promille).toBe(0);
    expect(status.warnings).toContain('no_active_session');
    expect(status.disclaimer).toBeDefined();
  });
});