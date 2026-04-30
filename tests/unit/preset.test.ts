import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setPreset, listPresets, getPreset, removePreset } from '../../src/commands/preset.js';

describe('preset commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should save and list presets', () => {
    setPreset(db, 'augustiner', 500, 5.2);
    const list = listPresets(db);
    expect(list.count).toBe(1);
    expect(list.items[0]?.name).toBe('augustiner');
  });
  
  it('should normalize preset names to lowercase', () => {
    setPreset(db, 'Augustiner', 500, 5.2);
    const preset = getPreset(db, 'augustiner');
    expect(preset.name).toBe('augustiner');
  });
  
  it('should reject invalid preset names', () => {
    expect(() => setPreset(db, 'Invalid Name!', 500, 5.2)).toThrow();
    expect(() => setPreset(db, '', 500, 5.2)).toThrow();
  });
  
  it('should remove presets', () => {
    setPreset(db, 'augustiner', 500, 5.2);
    removePreset(db, 'augustiner');
    const list = listPresets(db);
    expect(list.count).toBe(0);
  });
  
  it('should throw for unknown preset', () => {
    expect(() => getPreset(db, 'unknown')).toThrow();
  });
});