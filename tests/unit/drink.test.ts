import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import {
  addDrink,
  startDrink,
  stopDrink,
  listDrinks,
  removeDrink,
  getRunningDrink,
} from '../../src/commands/drink.js';

describe('drink commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });
  
  it('should add drink to active session', () => {
    startSession(db, { stomach: 'full' });
    const result = addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    expect(result.drink_id).toBeGreaterThan(0);
    expect(result.volume_ml).toBe(500);
    expect(result.abv).toBe(5.2);
    expect(result.stomach_state).toBe('full');
  });
  
  it('should reject drink outside session', () => {
    startSession(db, {});
    const past = new Date(Date.now() - 86400000);
    expect(() => addDrink(db, { volumeMl: 500, abv: 5.2, at: past })).toThrow();
  });
  
  it('should start and stop drink', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 40, abv: 40 });
    expect(startResult.drink_id).toBeGreaterThan(0);
    
    const running = getRunningDrink(db);
    expect(running).not.toBeNull();
    
    const stopResult = stopDrink(db);
    expect(stopResult.drink_id).toBe(startResult.drink_id);
    expect(stopResult.duration_secs).toBeGreaterThanOrEqual(0);
    
    const afterStop = getRunningDrink(db);
    expect(afterStop).toBeNull();
  });
  
  it('should reject second start without stop', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2 });
    expect(() => startDrink(db, { volumeMl: 500, abv: 5.2 })).toThrow();
  });
  
  it('should reject stop without running drink', () => {
    startSession(db, {});
    expect(() => stopDrink(db)).toThrow();
  });
  
  it('should list drinks', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    const list = listDrinks(db);
    expect(list.count).toBe(2);
  });
  
  it('should remove drink', () => {
    startSession(db, {});
    const result = addDrink(db, { volumeMl: 500, abv: 5.2 });
    
    removeDrink(db, result.drink_id);
    const list = listDrinks(db);
    expect(list.count).toBe(0);
  });
  
  it('should reject removing unknown drink', () => {
    expect(() => removeDrink(db, 999)).toThrow();
  });
  
  it('should respect drink duration', () => {
    startSession(db, {});
    const result = addDrink(db, { volumeMl: 500, abv: 5.2, duration: '25m' });
    
    const startedAt = new Date(result.started_at);
    const finishedAt = new Date(result.finished_at);
    const diff = (finishedAt.getTime() - startedAt.getTime()) / 60000;
    expect(diff).toBe(25);
  });
});
