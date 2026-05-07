import { describe, it, expect, beforeAll } from 'vitest';
import {
  initWasm,
  calculateBACAtOffset,
  generateCurve,
  getAbsorbingDrinkCount,
  getTrajectory,
} from '../../src/engine/wasm-loader.js';
import type { DrinkInput, ProfileParams } from '../../src/engine/types.js';

beforeAll(() => initWasm());

const profileMale75kg: ProfileParams = {
  weightKg: 75,
  heightCm: 180,
  sex: 'male',
  age: 30,
};

function makeBeer(volumeMl = 500, abv = 0.05): Omit<DrinkInput, 'startedAtMinutesAgo' | 'durationMinutes'> {
  return {
    volumeMl,
    abv,
    stomachFullness: 'some',
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function minutesAgo(reference: Date, target: Date): number {
  return (reference.getTime() - target.getTime()) / 60000;
}

describe('WASM-Bridge: Anti-Stub Smoke-Tests', () => {
  it('Watson != Widmark for same input (formula switch reaches WASM)', () => {
    const t0 = new Date('2026-05-01T19:00:00Z');
    const now = new Date('2026-05-01T20:00:00Z');
    const drinks: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: minutesAgo(now, t0), durationMinutes: 0 },
    ];
    const watson = calculateBACAtOffset(profileMale75kg, drinks, 'watson', 0);
    const widmark = calculateBACAtOffset(profileMale75kg, drinks, 'widmark', 0);
    expect(Math.abs(watson - widmark)).toBeGreaterThan(0.001);
    // MUSS: Werte unterscheiden sich um mindestens 0.001 Promille
  });

  it('instant drink peak is AFTER t=0, not at t=0 (ka model active)', () => {
    const t0 = new Date('2026-05-01T19:00:00Z');
    const drinks: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 0, durationMinutes: 0 },
    ];
    const curve = generateCurve(
      profileMale75kg, drinks, 'watson',
      0, 90, 1, 0.03, 0.06,
    );
    const peak = curve.points.reduce((max, p) => (p.bacPercent > max.bacPercent ? p : max));
    expect(peak.offsetMinutes).toBeGreaterThan(5);
    expect(peak.offsetMinutes).toBeLessThan(60);
    // MUSS: Peak liegt 5-45min nach Start (ka-Modell, nicht linear)
  });

  it('two drinks 30min apart > one drink (superposition reaches WASM)', () => {
    const now = new Date('2026-05-01T20:00:00Z');
    const single: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 60, durationMinutes: 0 },
    ];
    const double: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 60, durationMinutes: 0 },
      { ...makeBeer(), startedAtMinutesAgo: 30, durationMinutes: 0 },
    ];
    const singleBac = calculateBACAtOffset(profileMale75kg, single, 'watson', 0);
    const doubleBac = calculateBACAtOffset(profileMale75kg, double, 'watson', 0);
    expect(doubleBac).toBeGreaterThan(singleBac * 1.5);
    // MUSS: Doppel-Drink hat deutlich höheren BAC (>1.5x single)
  });

  it('empty vs full stomach changes peak timing (stomach state reaches WASM)', () => {
    const emptyDrinks: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 0, durationMinutes: 0, stomachFullness: 'empty' },
    ];
    const fullDrinks: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 0, durationMinutes: 0, stomachFullness: 'full' },
    ];
    const emptyCurve = generateCurve(
      profileMale75kg, emptyDrinks, 'watson',
      0, 180, 1, 0.03, 0.06,
    );
    const fullCurve = generateCurve(
      profileMale75kg, fullDrinks, 'watson',
      0, 180, 1, 0.03, 0.06,
    );
    const peakEmpty = emptyCurve.points.reduce((max, p) => (p.bacPercent > max.bacPercent ? p : max));
    const peakFull = fullCurve.points.reduce((max, p) => (p.bacPercent > max.bacPercent ? p : max));
    const deltaMin = Math.abs(peakEmpty.offsetMinutes - peakFull.offsetMinutes);
    expect(deltaMin).toBeGreaterThan(10);
    // MUSS: Peak-Zeitpunkte unterscheiden sich um >10min (ka empty != ka full)
  });

  it('absorbingDrinkCount reflects active drinks only', () => {
    const now = new Date('2026-05-01T20:00:00Z');
    const drinks: DrinkInput[] = [
      { ...makeBeer(), startedAtMinutesAgo: 30, durationMinutes: 0 },    // active at t+30min
      { ...makeBeer(), startedAtMinutesAgo: 240, durationMinutes: 0 },   // long-finished
    ];
    const count = getAbsorbingDrinkCount(drinks);
    expect(count).toBe(1);
    // MUSS: nur 1 Drink absorbiert noch
  });
});
