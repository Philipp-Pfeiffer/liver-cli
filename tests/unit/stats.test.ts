import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, endSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getStats } from '../../src/commands/stats.js';
import { setPreset } from '../../src/commands/preset.js';

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
    setPreset(db, 'augustiner', 500, 5.2);
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2, presetName: 'augustiner' });
    addDrink(db, { volumeMl: 500, abv: 5.2, presetName: 'augustiner' });
    
    const stats = getStats(db);
    expect(stats.by_preset.length).toBe(1);
    expect(stats.by_preset[0]?.count).toBe(2);
    expect(stats.by_preset[0]?.name).toBe('augustiner');
  });
});