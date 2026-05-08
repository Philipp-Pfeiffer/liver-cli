import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink } from '../../src/commands/drink.js';
import { getBACAt, getCurve } from '../../src/commands/compute.js';

describe('Suite C: Plausibility Bands', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  function testDrink(
    name: string,
    profile: { weight: number; height: number; sex: 'm' | 'f' | 'o'; age: number },
    drink: { volumeMl: number; abv: number; stomach: 'empty' | 'some' | 'full' },
    expectedRange: [number, number],
  ) {
    it(name, () => {
      setProfile(db, profile.weight, profile.height, profile.sex, profile.age);
      const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
      startSession(db, { stomach: drink.stomach, at: thirtyMinAgo });
      const result = addDrink(db, {
        volumeMl: drink.volumeMl,
        abv: drink.abv,
        at: thirtyMinAgo,
        stomach: drink.stomach,
      });

      const peak = result.bac_projected_peak_promille;
      expect(peak).toBeGreaterThanOrEqual(expectedRange[0]);
      expect(peak).toBeLessThanOrEqual(expectedRange[1]);
    });
  }

  testDrink(
    'C1: Bier 500ml 5% some STANDARD_MALE',
    { weight: 80, height: 180, sex: 'm', age: 30 },
    { volumeMl: 500, abv: 5.0, stomach: 'some' },
    [0.30, 0.55],
  );

  testDrink(
    'C2: Bier 500ml 5% some STANDARD_FEMALE',
    { weight: 65, height: 165, sex: 'f', age: 30 },
    { volumeMl: 500, abv: 5.0, stomach: 'some' },
    [0.45, 0.75],
  );

  testDrink(
    'C3: Spirit 40ml 40% empty STANDARD_MALE',
    { weight: 80, height: 180, sex: 'm', age: 30 },
    { volumeMl: 40, abv: 40.0, stomach: 'empty' },
    [0.20, 0.45],
  );

  testDrink(
    'C4: Wein 200ml 12% some STANDARD_MALE',
    { weight: 80, height: 180, sex: 'm', age: 30 },
    { volumeMl: 200, abv: 12.0, stomach: 'some' },
    [0.30, 0.55],
  );

  testDrink(
    'C5: Colabier 500ml 2.5% some STANDARD_MALE (Real-World Bug Case)',
    { weight: 80, height: 180, sex: 'm', age: 30 },
    { volumeMl: 500, abv: 2.5, stomach: 'some' },
    [0.10, 0.30],
  );

  testDrink(
    'C6: Big Beer 1000ml 5% some STANDARD_MALE',
    { weight: 80, height: 180, sex: 'm', age: 30 },
    { volumeMl: 1000, abv: 5.0, stomach: 'some' },
    [0.65, 1.05],
  );

  it('C7: bac --at and curve must agree at the same wall-clock point', () => {
    setProfile(db, 80, 180, 'm', 30);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'some', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.0, at: thirtyMinAgo, stomach: 'some' });

    const checkTime = new Date(Date.now() + 60 * 60000);
    const bacResult = getBACAt(db, checkTime) as Record<string, unknown>;
    const curveResult = getCurve(db, {
      from: new Date(checkTime.getTime() - 5 * 60000),
      to: new Date(checkTime.getTime() + 5 * 60000),
      step: 1,
    }) as Record<string, unknown>;

    const bacValue = (bacResult.bac_promille as number) ?? -1;
    const curve = curveResult.curve as Array<{ at: string; bac_promille: number }>;
    const curvePoint = curve.find(
      (p) => Math.abs(new Date(p.at).getTime() - checkTime.getTime()) < 30000,
    );

    expect(curvePoint).toBeDefined();
    const curveValue = curvePoint!.bac_promille;

    // Values must agree within ±0.001‰
    expect(Math.abs(bacValue - curveValue)).toBeLessThanOrEqual(0.001);
  });
});
