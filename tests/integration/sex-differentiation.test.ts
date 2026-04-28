import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, endSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getStatus } from '../../src/commands/compute.js';

describe('Sex Differentiation Test', () => {
  function createDbWithProfile(sex: string) {
    const db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, sex, 22);
    return db;
  }

  it('should produce different BAC for male, female, and other', () => {
    const dbMale = createDbWithProfile('m');
    const dbFemale = createDbWithProfile('f');
    const dbOther = createDbWithProfile('o');

    startSession(dbMale, { stomach: 'full' });
    startSession(dbFemale, { stomach: 'full' });
    startSession(dbOther, { stomach: 'full' });

    addDrink(dbMale, { volumeMl: 500, abv: 5.0 });
    addDrink(dbFemale, { volumeMl: 500, abv: 5.0 });
    addDrink(dbOther, { volumeMl: 500, abv: 5.0 });

    const statusMale = getStatus(dbMale) as { bac_promille: number };
    const statusFemale = getStatus(dbFemale) as { bac_promille: number };
    const statusOther = getStatus(dbOther) as { bac_promille: number };

    // Female should have higher BAC due to lower r factor (0.55 vs 0.68)
    expect(statusFemale.bac_promille).toBeGreaterThan(statusMale.bac_promille);
    
    // Other should have different BAC than male (r = 0.615 vs 0.68)
    expect(statusOther.bac_promille).not.toBe(statusMale.bac_promille);
    
    // Order should be: female > other > male (due to r factors)
    expect(statusFemale.bac_promille).toBeGreaterThan(statusOther.bac_promille);
    expect(statusOther.bac_promille).toBeGreaterThan(statusMale.bac_promille);

    dbMale.close();
    dbFemale.close();
    dbOther.close();
  });
});
