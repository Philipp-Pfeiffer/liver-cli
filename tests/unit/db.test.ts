import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe('database schema', () => {
  it('should have all tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as Array<{ name: string }>;
    
    const names = tables.map(t => t.name);
    expect(names).toContain('profile');
    expect(names).toContain('presets');
    expect(names).toContain('sessions');
    expect(names).toContain('stomach_events');
    expect(names).toContain('drinks');
    expect(names).toContain('config');
  });
  
  it('should enforce profile constraints', () => {
    const insert = db.prepare(
      'INSERT INTO profile (weight_kg, height_cm, sex, age) VALUES (?, ?, ?, ?)'
    );
    
    expect(() => insert.run(70, 180, 'm', 25)).not.toThrow();
    expect(() => insert.run(20, 180, 'm', 25)).toThrow();
    expect(() => insert.run(300, 180, 'm', 25)).toThrow();
    expect(() => insert.run(70, 100, 'm', 25)).toThrow();
    expect(() => insert.run(70, 180, 'x', 25)).toThrow();
    expect(() => insert.run(70, 180, 'm', 10)).toThrow();
  });
  
  it('should enforce preset name constraints', () => {
    const insert = db.prepare(
      'INSERT INTO presets (name, volume_ml, abv, created_at) VALUES (?, ?, ?, ?)'
    );
    
    expect(() => insert.run('augustiner', 500, 5.2, '2026-04-28T00:00:00Z')).not.toThrow();
    expect(() => insert.run('INVALID NAME', 500, 5.2, '2026-04-28T00:00:00Z')).toThrow();
    expect(() => insert.run('', 500, 5.2, '2026-04-28T00:00:00Z')).toThrow();
  });
});