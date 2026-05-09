import { describe, it, expect, vi } from 'vitest';
import { defaultBeta, clampBeta, effectiveBeta, FED_BETA_MULT } from '../../src/engine/beta.js';
import { STOMACH_FACTORS } from '../../src/engine/types.js';

describe('beta module', () => {
  describe('defaultBeta', () => {
    it('male <= 25 returns 0.165', () => {
      expect(defaultBeta('m', 21)).toBe(0.165);
      expect(defaultBeta('m', 25)).toBe(0.165);
    });

    it('male 26-60 returns 0.15', () => {
      expect(defaultBeta('m', 30)).toBe(0.15);
      expect(defaultBeta('m', 60)).toBe(0.15);
    });

    it('male > 60 returns 0.13', () => {
      expect(defaultBeta('m', 65)).toBe(0.13);
    });

    it('female <= 25 returns 0.16', () => {
      expect(defaultBeta('f', 21)).toBe(0.16);
      expect(defaultBeta('f', 25)).toBe(0.16);
    });

    it('female 26-60 returns 0.15', () => {
      expect(defaultBeta('f', 30)).toBe(0.15);
      expect(defaultBeta('f', 60)).toBe(0.15);
    });

    it('female > 60 returns 0.14', () => {
      expect(defaultBeta('f', 65)).toBe(0.14);
    });

    it('other returns 0.16', () => {
      expect(defaultBeta('o', 30)).toBe(0.16);
    });
  });

  describe('clampBeta', () => {
    it('returns beta inside range unchanged', () => {
      expect(clampBeta(0.15)).toBe(0.15);
    });

    it('clamps below minimum', () => {
      expect(clampBeta(0.05)).toBe(0.1);
    });

    it('clamps above maximum', () => {
      expect(clampBeta(0.3)).toBe(0.25);
    });
  });

  describe('effectiveBeta', () => {
    it('empty multiplier is 1.0', () => {
      expect(effectiveBeta(0.165, 'empty')).toBeCloseTo(0.165, 6);
    });

    it('some multiplier is 1.20', () => {
      expect(effectiveBeta(0.165, 'some')).toBeCloseTo(0.198, 6);
    });

    it('full multiplier is 1.40', () => {
      expect(effectiveBeta(0.165, 'full')).toBeCloseTo(0.231, 6);
    });
  });

  describe('stomach factor and fed multiplier are distinct', () => {
    it('does not double-count', () => {
      // Absorption-side stomach factor for 'some' is 0.80
      expect(STOMACH_FACTORS.some).toBe(0.8);
      // Elimination-side fed multiplier for 'some' is 1.20
      expect(FED_BETA_MULT.some).toBe(1.2);
      // They are different values
      expect(STOMACH_FACTORS.some).not.toBe(FED_BETA_MULT.some);
      // They operate on different domains (bioavailability vs elimination rate)
      const absorptionFactor = STOMACH_FACTORS.some;
      const eliminationMult = FED_BETA_MULT.some;
      const baseBeta = 0.165;
      const effective = effectiveBeta(baseBeta, 'some');
      expect(effective).toBe(baseBeta * eliminationMult);
      expect(effective).not.toBe(baseBeta * absorptionFactor);
    });
  });

  describe('clamp ordering', () => {
    it('clamps effective beta after fed multiplier (override × full meal)', () => {
      // base 0.20 × 1.40 = 0.28 → clamped to 0.25
      expect(clampBeta(effectiveBeta(0.20, 'full'))).toBe(0.25);
    });

    it('does not clamp when effective stays in band', () => {
      // base 0.165 × 1.20 = 0.198 → in band, unchanged
      expect(clampBeta(effectiveBeta(0.165, 'some'))).toBeCloseTo(0.198, 6);
    });

    it('warns on clamp', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      clampBeta(effectiveBeta(0.20, 'full'));
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
