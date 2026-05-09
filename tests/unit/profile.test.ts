import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile, getProfile, requireProfile } from '../../src/commands/profile.js';

describe('profile commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should set and get profile', () => {
    setProfile(db, 78, 184, 'm', 22, 'watson');
    const profile = getProfile(db);
    expect(profile).not.toBeNull();
    expect(profile?.weight_kg).toBe(78);
    expect(profile?.height_cm).toBe(184);
    expect(profile?.sex).toBe('m');
    expect(profile?.age).toBe(22);
    expect(profile?.preferred_formula).toBe('watson');
    expect(profile?.weight_source).toBe('estimated');
  });

  it('should set weight_source', () => {
    setProfile(db, 78, 184, 'm', 22, undefined, 'measured');
    const profile = getProfile(db);
    expect(profile?.weight_source).toBe('measured');
  });
  
  it('should require profile', () => {
    expect(() => requireProfile(db, 'status')).toThrow();
    setProfile(db, 78, 184, 'm', 22);
    expect(() => requireProfile(db, 'status')).not.toThrow();
  });
  
  it('should validate profile data', () => {
    expect(() => setProfile(db, 20, 180, 'm', 22)).toThrow();
    expect(() => setProfile(db, 78, 100, 'm', 22)).toThrow();
    expect(() => setProfile(db, 78, 180, 'x', 22)).toThrow();
    expect(() => setProfile(db, 78, 180, 'm', 10)).toThrow();
  });
  
  it('should replace existing profile', () => {
    setProfile(db, 78, 184, 'm', 22);
    setProfile(db, 80, 185, 'f', 25);
    const profile = getProfile(db);
    expect(profile?.weight_kg).toBe(80);
  });
});