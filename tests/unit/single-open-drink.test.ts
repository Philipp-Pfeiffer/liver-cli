import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { startDrink, stopDrink, addDrink } from '../../src/commands/drink.js';
import { LiverError } from '../../src/errors/index.js';

describe('single open drink rule', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('should reject second start without --force', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2 });
    try {
      startDrink(db, { volumeMl: 330, abv: 4.7 });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LiverError);
      expect((error as LiverError).code).toBe('E_DRINK_ALREADY_OPEN');
    }
  });

  it('should allow second start with --force', () => {
    startSession(db, {});
    const first = startDrink(db, { volumeMl: 500, abv: 5.2 });
    const second = startDrink(db, { volumeMl: 330, abv: 4.7, force: true });

    expect(second.force_closed_drinks).toBeDefined();
    expect(second.force_closed_drinks!.length).toBe(1);
    expect(second.force_closed_drinks![0].drink_id).toBe(first.drink_id);
  });

  it('should allow add during running drink', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2 });
    const addResult = addDrink(db, { volumeMl: 40, abv: 40 });
    expect(addResult.drink_id).toBeGreaterThan(0);
  });
});
