import { describe, it, expect } from 'vitest';
import { parseTimestamp, parseDuration, formatISOUTC, minutesBetween } from '../../src/time/index.js';

describe('time utilities', () => {
  it('should parse ISO timestamp', () => {
    const date = parseTimestamp('2026-04-28T19:30:00+02:00');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCHours()).toBe(17);
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
});