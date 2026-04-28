import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, setConfig, listConfig } from '../../src/config/index.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_CONFIG = join(homedir(), '.liver', 'config');

describe('Config Round-Trip Test', () => {
  beforeEach(() => {
    try { rmSync(TEST_CONFIG); } catch {}
  });

  afterEach(() => {
    try { rmSync(TEST_CONFIG); } catch {}
  });

  it('should store numbers as JSON numbers, not strings', () => {
    setConfig('zones.sweet_spot_min', '0.3');
    const value = getConfig('zones.sweet_spot_min');
    expect(value).toBe(0.3);
    expect(typeof value).toBe('number');
  });

  it('should round-trip numeric values correctly', () => {
    setConfig('zones.sweet_spot_min', 0.35);
    setConfig('zones.sweet_spot_max', 0.75);
    
    expect(getConfig('zones.sweet_spot_min')).toBe(0.35);
    expect(getConfig('zones.sweet_spot_max')).toBe(0.75);
    
    const list = listConfig();
    expect(list['zones.sweet_spot_min']).toBe(0.35);
    expect(list['zones.sweet_spot_max']).toBe(0.75);
  });

  it('should fall back to string for non-JSON values', () => {
    // This tests the fallback behavior - even though our keys don't typically
    // use strings, the parsing should fallback gracefully
    setConfig('zones.sweet_spot_min', 'hello');
    expect(getConfig('zones.sweet_spot_min')).toBe('hello');
  });
});
