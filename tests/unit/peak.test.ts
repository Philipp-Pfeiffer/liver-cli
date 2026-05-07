import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink, startDrink, stopDrink } from '../../src/commands/drink.js';

describe('peak projection', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('add should include bac_projected_peak_promille and bac_projected_peak_at', () => {
    startSession(db, {});
    const result = addDrink(db, { volumeMl: 500, abv: 5.0 });

    expect(result.bac_projected_peak_promille).toBeDefined();
    expect(result.bac_projected_peak_at).toBeDefined();
    expect(typeof result.bac_projected_peak_promille).toBe('number');
    expect(result.bac_projected_peak_promille).toBeGreaterThan(0);
  });

  it('start should include bac_before and bac_projected_peak', () => {
    startSession(db, {});
    const result = startDrink(db, { volumeMl: 500, abv: 5.0 });

    expect(result.bac_before_promille).toBeDefined();
    expect(result.bac_projected_peak_promille).toBeDefined();
    expect(result.bac_projected_peak_at).toBeDefined();
    expect(typeof result.bac_before_promille).toBe('number');
    expect(typeof result.bac_projected_peak_promille).toBe('number');
  });

  it('stop should include bac_at_stop and bac_projected_peak', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.0 });
    const result = stopDrink(db);

    expect(result.bac_at_stop_promille).toBeDefined();
    expect(result.bac_projected_peak_promille).toBeDefined();
    expect(result.bac_projected_peak_at).toBeDefined();
    expect(typeof result.bac_at_stop_promille).toBe('number');
    expect(typeof result.bac_projected_peak_promille).toBe('number');
  });

  it('multi-drink should have higher peak than single drink', () => {
    startSession(db, {});
    const first = addDrink(db, { volumeMl: 500, abv: 5.0 });
    const second = addDrink(db, { volumeMl: 500, abv: 5.0 });

    expect(second.bac_projected_peak_promille).toBeGreaterThan(first.bac_projected_peak_promille);
  });
});
