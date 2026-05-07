import { describe, it, expect } from 'vitest';
import { VOLUME_DURATION_TABLE, resolveDefaultDuration } from '../../src/lib/duration.js';

describe('duration', () => {
  describe('VOLUME_DURATION_TABLE', () => {
    it('has 7 entries covering all volumes', () => {
      expect(VOLUME_DURATION_TABLE.length).toBe(7);
      expect(VOLUME_DURATION_TABLE[VOLUME_DURATION_TABLE.length - 1].maxMl).toBe(Infinity);
    });
  });

  describe('resolveDefaultDuration', () => {
    it('returns config_override when default_duration_minutes is set', () => {
      const result = resolveDefaultDuration(500, { default_duration_minutes: 30 });
      expect(result.minutes).toBe(30);
      expect(result.source).toBe('config_override');
    });

    it('returns volume_table for 50ml (shot)', () => {
      const result = resolveDefaultDuration(50, {});
      expect(result.minutes).toBe(1);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 200ml (wine glass)', () => {
      const result = resolveDefaultDuration(200, {});
      expect(result.minutes).toBe(20);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 350ml (0.33L beer)', () => {
      const result = resolveDefaultDuration(350, {});
      expect(result.minutes).toBe(30);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 550ml (0.5L beer)', () => {
      const result = resolveDefaultDuration(550, {});
      expect(result.minutes).toBe(45);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 800ml (wine share)', () => {
      const result = resolveDefaultDuration(800, {});
      expect(result.minutes).toBe(60);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 1100ml (Maß)', () => {
      const result = resolveDefaultDuration(1100, {});
      expect(result.minutes).toBe(90);
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 1500ml (large)', () => {
      const result = resolveDefaultDuration(1500, {});
      expect(result.minutes).toBe(120);
      expect(result.source).toBe('volume_table');
    });

    it('returns fallback_20min for 0ml (edge case)', () => {
      const result = resolveDefaultDuration(0, {});
      expect(result.minutes).toBe(1); // 0 <= 50
      expect(result.source).toBe('volume_table');
    });

    it('returns volume_table for 51ml (just above shot)', () => {
      const result = resolveDefaultDuration(51, {});
      expect(result.minutes).toBe(20);
      expect(result.source).toBe('volume_table');
    });

    it('uses custom duration_table from config', () => {
      const result = resolveDefaultDuration(500, {
        duration_table: { '100': 5, '500': 25, '1000': 50 },
      });
      expect(result.minutes).toBe(25);
      expect(result.source).toBe('volume_table');
    });

    it('config override takes priority over duration_table', () => {
      const result = resolveDefaultDuration(500, {
        default_duration_minutes: 15,
        duration_table: { '100': 5, '500': 25 },
      });
      expect(result.minutes).toBe(15);
      expect(result.source).toBe('config_override');
    });
  });
});
