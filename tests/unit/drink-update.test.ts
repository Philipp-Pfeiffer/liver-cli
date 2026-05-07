import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink, updateDrink } from '../../src/commands/drink.js';
import { LiverError } from '../../src/errors/index.js';
import { formatISOUTC } from '../../src/time/index.js';

describe('drink update', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('should update drink duration', () => {
    startSession(db, {});
    const drink = addDrink(db, { volumeMl: 500, abv: 5.0, duration: '30m' });

    const result = updateDrink(db, { id: drink.drink_id, duration: '60m' });
    expect(result.drink.finished_at).toBeDefined();

    const startedAt = new Date(drink.started_at);
    const finishedAt = new Date(result.drink.finished_at!);
    const diffMin = (finishedAt.getTime() - startedAt.getTime()) / 60000;
    expect(diffMin).toBe(60);
  });

  it('should update drink finished-at', () => {
    startSession(db, {});
    const drink = addDrink(db, { volumeMl: 500, abv: 5.0, duration: '30m' });

    const newFinishedAt = new Date(Date.now() + 90 * 60000);
    const result = updateDrink(db, { id: drink.drink_id, finishedAt: newFinishedAt });
    expect(result.drink.finished_at).toBe(formatISOUTC(newFinishedAt));
  });

  it('should reject update without duration or finished-at', () => {
    startSession(db, {});
    const drink = addDrink(db, { volumeMl: 500, abv: 5.0 });

    expect(() => updateDrink(db, { id: drink.drink_id })).toThrow('Must provide exactly one of --duration or --finished-at');
  });

  it('should reject update with both duration and finished-at', () => {
    startSession(db, {});
    const drink = addDrink(db, { volumeMl: 500, abv: 5.0 });

    expect(() => updateDrink(db, {
      id: drink.drink_id,
      duration: '30m',
      finishedAt: new Date(),
    })).toThrow('Must provide exactly one of --duration or --finished-at');
  });

  it('should warn when updating already-closed drink', () => {
    startSession(db, {});
    const drink = addDrink(db, { volumeMl: 500, abv: 5.0 });

    const result = updateDrink(db, { id: drink.drink_id, duration: '60m' });
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('already-closed');
  });

  it('should reject update for non-existent drink', () => {
    startSession(db, {});
    try {
      updateDrink(db, { id: 999, duration: '30m' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LiverError);
      expect((error as LiverError).code).toBe('DRINK_NOT_FOUND');
    }
  });
});
