import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, setConfig, listConfig, getSweetSpotDefaults } from '../../src/config/index.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_CONFIG = join(homedir(), '.liver', 'config');

beforeEach(() => {
  try { rmSync(TEST_CONFIG); } catch {}
});

afterEach(() => {
  try { rmSync(TEST_CONFIG); } catch {}
});

describe('config', () => {
  it('should set and get config values', () => {
    setConfig('zones.sweet_spot_min', 0.5);
    expect(getConfig('zones.sweet_spot_min')).toBe(0.5);
  });
  
  it('should reject invalid keys', () => {
    expect(() => setConfig('invalid.key', 1)).toThrow();
    expect(() => getConfig('invalid.key')).toThrow();
  });
  
  it('should return default sweet spot values', () => {
    const defaults = getSweetSpotDefaults();
    expect(defaults.min).toBe(0.4);
    expect(defaults.max).toBe(0.8);
  });
  
  it('should use custom sweet spot values', () => {
    setConfig('zones.sweet_spot_min', 0.3);
    setConfig('zones.sweet_spot_max', 0.6);
    const defaults = getSweetSpotDefaults();
    expect(defaults.min).toBe(0.3);
    expect(defaults.max).toBe(0.6);
  });
});