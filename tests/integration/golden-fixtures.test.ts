import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession, endSession } from '../../src/commands/session.js';
import { addDrink, startDrink, stopDrink } from '../../src/commands/drink.js';
import { getStatus, getBACAt, getSober, getCurve } from '../../src/commands/compute.js';
import { getStats } from '../../src/commands/stats.js';

describe('Golden Fixture Tests', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  it('add output has correct schema with bac_after_promille', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    const result = addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    
    expect(result).toHaveProperty('drink_id');
    expect(result).toHaveProperty('session_id');
    expect(result).toHaveProperty('started_at');
    expect(result).toHaveProperty('finished_at');
    expect(result).toHaveProperty('volume_ml');
    expect(result).toHaveProperty('abv');
    expect(result).toHaveProperty('preset_name');
    expect(result).toHaveProperty('stomach_state');
    expect(result).toHaveProperty('bac_after_promille');
    
    expect(result.volume_ml).toBe(500);
    expect(result.abv).toBe(5.2);
    expect(result.bac_after_promille).toBeGreaterThanOrEqual(0);
    expect(typeof result.bac_after_promille).toBe('number');
  });

  it('start output has correct schema with bac_after_promille', () => {
    startSession(db, { stomach: 'full' });
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    const result = startDrink(db, { volumeMl: 40, abv: 40, at: thirtyMinAgo });
    
    expect(result).toHaveProperty('drink_id');
    expect(result).toHaveProperty('session_id');
    expect(result).toHaveProperty('started_at');
    expect(result).toHaveProperty('volume_ml');
    expect(result).toHaveProperty('abv');
    expect(result).toHaveProperty('preset_name');
    expect(result).toHaveProperty('stomach_state');
    expect(result).toHaveProperty('bac_after_promille');
    
    expect(result.bac_after_promille).toBeGreaterThanOrEqual(0);
    expect(typeof result.bac_after_promille).toBe('number');
  });

  it('status output has correct schema', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    const result = getStatus(db) as Record<string, unknown>;
    
    expect(result).toHaveProperty('now');
    expect(result).toHaveProperty('session_id');
    expect(result).toHaveProperty('bac_percent');
    expect(result).toHaveProperty('bac_promille');
    expect(result).toHaveProperty('trajectory');
    expect(result).toHaveProperty('absorbing_drinks');
    expect(result).toHaveProperty('minutes_until_sober');
    expect(result).toHaveProperty('sober_at');
    expect(result).toHaveProperty('zone');
    expect(result).toHaveProperty('drinks_in_session');
    expect(result).toHaveProperty('stomach_state_now');
    expect(result).toHaveProperty('disclaimer');
    
    expect(result.bac_promille).toBeGreaterThan(0);
    expect(result.minutes_until_sober).toBeGreaterThan(0);
    expect(result.disclaimer).toBe('estimate, not legally/medically valid');
  });

  it('bac output has correct schema', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    const now = new Date();
    const result = getBACAt(db, now) as Record<string, unknown>;
    
    expect(result).toHaveProperty('at');
    expect(result).toHaveProperty('bac_percent');
    expect(result).toHaveProperty('bac_promille');
    expect(result).toHaveProperty('zone');
    expect(result).toHaveProperty('formula');
    expect(result).toHaveProperty('disclaimer');
    
    expect(result.bac_promille).toBeGreaterThan(0);
  });

  it('sober output has correct schema', () => {
    // Create drink 30min ago so ka-model has time to absorb
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    startSession(db, { stomach: 'full', at: thirtyMinAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: thirtyMinAgo });
    const result = getSober(db) as Record<string, unknown>;
    
    expect(result).toHaveProperty('minutes_until_sober');
    expect(result).toHaveProperty('sober_at');
    expect(result).toHaveProperty('disclaimer');
    
    expect(result.minutes_until_sober).toBeGreaterThan(0);
  });

  it('curve output has correct schema', () => {
    startSession(db, { stomach: 'full' });
    addDrink(db, { volumeMl: 500, abv: 5.2 });
    const result = getCurve(db, { step: 5 }) as Record<string, unknown>;
    
    expect(result).toHaveProperty('curve');
    expect(result).toHaveProperty('meta');
    
    const meta = result.meta as Record<string, unknown>;
    expect(meta).toHaveProperty('from');
    expect(meta).toHaveProperty('to');
    expect(meta).toHaveProperty('step_min');
    expect(meta).toHaveProperty('points');
    expect(meta).toHaveProperty('formula');
    
    const curve = result.curve as Array<Record<string, unknown>>;
    expect(curve.length).toBeGreaterThan(0);
    expect(curve[0]).toHaveProperty('at');
    expect(curve[0]).toHaveProperty('bac_promille');
    expect(curve[0]).toHaveProperty('zone');
  });

  it('stats output has correct schema with computed values', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    startSession(db, { stomach: 'full', at: yesterday });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: yesterday });
    endSession(db, { at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000) });
    
    const result = getStats(db);
    
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('drinking_days');
    expect(result).toHaveProperty('dry_days');
    expect(result).toHaveProperty('longest_dry_streak');
    expect(result).toHaveProperty('current_dry_streak');
    expect(result).toHaveProperty('total_drinks');
    expect(result).toHaveProperty('total_sessions');
    expect(result).toHaveProperty('total_pure_alcohol_g');
    expect(result).toHaveProperty('avg_peak_promille');
    expect(result).toHaveProperty('avg_session_promille');
    expect(result).toHaveProperty('max_session_promille');
    expect(result).toHaveProperty('by_preset');
    
    // Verify that BAC metrics are actually computed, not hard-coded 0
    expect(result.avg_peak_promille).toBeGreaterThan(0);
    expect(result.avg_session_promille).toBeGreaterThan(0);
    expect(result.max_session_promille).toBeGreaterThan(0);
    
    expect(result.total_drinks).toBe(1);
    expect(result.total_sessions).toBe(1);
  });

  it('stats with multiple sessions computes correct aggregates', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Session 1: two days ago
    startSession(db, { stomach: 'full', at: twoDaysAgo });
    addDrink(db, { volumeMl: 500, abv: 5.2, at: twoDaysAgo });
    endSession(db, { at: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000) });
    
    // Session 2: yesterday
    startSession(db, { stomach: 'full', at: yesterday });
    addDrink(db, { volumeMl: 1000, abv: 5.2, at: yesterday });
    endSession(db, { at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000) });
    
    const result = getStats(db);
    
    expect(result.total_sessions).toBe(2);
    expect(result.total_drinks).toBe(2);
    
    // Peak of session 2 should be higher than session 1 (more alcohol)
    expect(result.max_session_promille).toBeGreaterThanOrEqual(result.avg_peak_promille);
    expect(result.avg_peak_promille).toBeGreaterThan(0);
    expect(result.avg_session_promille).toBeGreaterThan(0);
  });
});
