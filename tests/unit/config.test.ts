import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { getConfig, setConfig, listConfig, getSweetSpotDefaults } from '../../src/config/index.js';

describe('config', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('should set and get config values', () => {
    setConfig('zones.sweet_spot_min', 0.5, db);
    expect(getConfig('zones.sweet_spot_min', db)).toBe(0.5);
  });

  it('should reject invalid keys', () => {
    expect(() => setConfig('invalid.key', 1, db)).toThrow();
    expect(() => getConfig('invalid.key', db)).toThrow();
  });

  it('should return default sweet spot values', () => {
    const defaults = getSweetSpotDefaults(db);
    expect(defaults.min).toBe(0.4);
    expect(defaults.max).toBe(0.8);
  });

  it('should use custom sweet spot values', () => {
    setConfig('zones.sweet_spot_min', 0.3, db);
    setConfig('zones.sweet_spot_max', 0.6, db);
    const defaults = getSweetSpotDefaults(db);
    expect(defaults.min).toBe(0.3);
    expect(defaults.max).toBe(0.6);
  });

  it('should list all config', () => {
    setConfig('zones.sweet_spot_min', 0.3, db);
    setConfig('zones.sweet_spot_max', 0.6, db);
    const config = listConfig(db);
    expect(config['zones.sweet_spot_min']).toBe(0.3);
    expect(config['zones.sweet_spot_max']).toBe(0.6);
  });
});
