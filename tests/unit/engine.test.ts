import { describe, it, expect } from 'vitest';
import { calculateBACAtOffset, getMinutesUntilSober, resolveFormula } from '../../src/engine/index.js';
import type { ProfileParams, DrinkInput } from '../../src/engine/types.js';

const profile: ProfileParams = {
  weightKg: 78,
  heightCm: 184,
  sex: 'male',
  age: 22,
};

const drink: DrinkInput = {
  volumeMl: 500,
  abv: 0.052,
  durationMinutes: 0,
  startedAtMinutesAgo: 60,
  stomachFullness: 'full',
};

describe('engine', () => {
  it('should calculate BAC > 0 after drinking', () => {
    const bac = calculateBACAtOffset(profile, [drink], 'watson', 0);
    expect(bac).toBeGreaterThan(0);
  });
  
  it('should calculate decreasing BAC over time', () => {
    const bacNow = calculateBACAtOffset(profile, [drink], 'watson', 0);
    const bacLater = calculateBACAtOffset(profile, [drink], 'watson', 120);
    expect(bacLater).toBeLessThan(bacNow);
  });
  
  it('should return 0 BAC when sober', () => {
    const bac = calculateBACAtOffset(profile, [], 'watson', 0);
    expect(bac).toBe(0);
  });
  
  it('should compute minutes until sober', () => {
    const mins = getMinutesUntilSober(profile, [drink], 'watson');
    expect(mins).toBeGreaterThan(0);
  });
  
  it('should resolve formula correctly', () => {
    expect(resolveFormula('watson', undefined)).toBe('watson');
    expect(resolveFormula('widmark', undefined)).toBe('widmark');
    expect(resolveFormula(undefined, 'widmark')).toBe('widmark');
    expect(resolveFormula('watson', 'widmark')).toBe('widmark');
    expect(resolveFormula(null, undefined)).toBe('watson');
  });
});