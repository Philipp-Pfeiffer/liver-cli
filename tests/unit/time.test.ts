import { describe, it, expect } from 'vitest';
import { parseTimestamp, parseDuration, formatISOUTC, minutesBetween } from '../../src/time/index.js';

describe('time utilities', () => {
  it('should parse ISO timestamp with explicit timezone', () => {
    const date = parseTimestamp('2026-04-28T19:30:00+02:00');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCHours()).toBe(17);
  });

  it('should interpret naive ISO datetime as Europe/Berlin', () => {
    // 2026-04-28T19:30 in Berlin (CEST, +2h) = 17:30 UTC
    const date = parseTimestamp('2026-04-28T19:30');
    expect(date.getUTCHours()).toBe(17);
    expect(date.getUTCMinutes()).toBe(30);
  });

  it('should interpret bare date as Europe/Berlin midnight', () => {
    const date = parseTimestamp('2026-04-28');
    // Midnight Berlin on 2026-04-28 (CEST, +2h) = 22:00 UTC previous day
    expect(date.getUTCHours()).toBe(22);
    expect(date.getUTCDate()).toBe(27);
  });

  it('should parse time-only as past', () => {
    const ref = new Date('2026-04-28T12:00:00Z');
    const date = parseTimestamp('10:00', ref);
    expect(date.getDate()).toBe(28);
  });

  it('should parse future time as yesterday', () => {
    const ref = new Date('2026-04-28T10:00:00Z');
    const date = parseTimestamp('12:00', ref);
    expect(date.getUTCDate()).toBe(28);
  });

  it('should parse duration in minutes', () => {
    expect(parseDuration('15m')).toBe(15);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('0')).toBe(0);
  });

  it('should reject invalid duration', () => {
    expect(() => parseDuration('25h')).toThrow();
    expect(() => parseDuration('invalid')).toThrow();
  });

  it('should format UTC ISO', () => {
    const date = new Date('2026-04-28T17:30:00Z');
    expect(formatISOUTC(date)).toBe('2026-04-28T17:30:00.000Z');
  });

  describe('DST edge cases', () => {
    it('should reject non-existent time during spring DST transition', () => {
      // 2026-03-29: clocks spring forward at 02:00 → 03:00
      expect(() => parseTimestamp('2026-03-29T02:30')).toThrow();
    });

    it('should accept valid time before spring DST transition', () => {
      const date = parseTimestamp('2026-03-29T01:30');
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it('should accept valid time after spring DST transition', () => {
      const date = parseTimestamp('2026-03-29T03:30');
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it('should accept ambiguous time during autumn DST transition', () => {
      // 2026-10-25: clocks fall back at 03:00 → 02:00, so 02:30 exists twice
      const date = parseTimestamp('2026-10-25T02:30');
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });
});