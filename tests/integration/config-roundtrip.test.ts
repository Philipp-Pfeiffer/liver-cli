import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, setConfig, listConfig } from '../../src/config/index.js';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';

describe('Config Round-Trip Test', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    db.prepare('DELETE FROM config').run();
  });

  it('should store numbers as JSON numbers, not strings', () => {
    setConfig('zones.sweet_spot_min', '0.3', db);
    const value = getConfig('zones.sweet_spot_min', db);
    expect(value).toBe(0.3);
    expect(typeof value).toBe('number');
  });

  it('should round-trip numeric values correctly', () => {
    setConfig('zones.sweet_spot_min', 0.35, db);
    setConfig('zones.sweet_spot_max', 0.75, db);

    expect(getConfig('zones.sweet_spot_min', db)).toBe(0.35);
    expect(getConfig('zones.sweet_spot_max', db)).toBe(0.75);

    const list = listConfig(db);
    expect(list['zones.sweet_spot_min']).toBe(0.35);
    expect(list['zones.sweet_spot_max']).toBe(0.75);
  });

  it('should fall back to string for non-JSON values', () => {
    // This tests the fallback behavior - even though our keys don't typically
    // use strings, the parsing should fallback gracefully
    setConfig('zones.sweet_spot_min', 'hello', db);
    expect(getConfig('zones.sweet_spot_min', db)).toBe('hello');
  });
});
