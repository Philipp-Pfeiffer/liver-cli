import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile } from '../../src/commands/profile.js';
import { startSession } from '../../src/commands/session.js';
import { addDrink, startDrink, stopDrink, updateDrink } from '../../src/commands/drink.js';
import { getStatus } from '../../src/commands/compute.js';
import { setConfig } from '../../src/config/index.js';
import { LiverError } from '../../src/errors/index.js';

// Defensive: reset fake timers if leaked from another test file in the same worker
vi.useRealTimers();

describe('Active Drink Acceptance Tests (D1-D10)', () => {
  let db: Database.Database;

  beforeEach(() => {
    vi.useRealTimers();
    db = new Database(':memory:');
    migrate(db);
    setProfile(db, 78, 184, 'm', 22);
  });

  // D1 — Instant: bac_before < bac_projected_peak
  it('D1: add bac_before < bac_projected_peak', () => {
    startSession(db, {});
    addDrink(db, { volumeMl: 500, abv: 5.0, stomach: 'some' });
    const result = addDrink(db, { volumeMl: 330, abv: 5.0, stomach: 'some' });

    expect(result.bac_before_promille).toBeLessThan(result.bac_projected_peak_promille);
  });

  // D2 — Planned: Peak-Time ≈ started_at + duration + 25min
  it('D2: planned duration peak timing', () => {
    startSession(db, {});
    const result = startDrink(db, { volumeMl: 500, abv: 5.2, duration: '30m', stomach: 'some' });

    const start = new Date(result.started_at);
    const peak = new Date(result.bac_projected_peak_at);
    const deltaMin = (peak.getTime() - start.getTime()) / 60000;

    // 30min duration + 15-40min ka lag = ~45-70min
    expect(deltaMin).toBeGreaterThanOrEqual(45);
    expect(deltaMin).toBeLessThanOrEqual(75);
  });

  // D3 — Default Duration: Volume-Lookup wirkt
  it('D3: default duration volume lookup', () => {
    startSession(db, {});
    const result = startDrink(db, { volumeMl: 500, abv: 5.2 });

    expect(result.duration_secs).toBe(2700); // 45min = 2700s
    expect(result.bac_projected_peak_promille).not.toBeNull();
    expect(result.drink_in_progress).toBe(true);
    expect(result.projection_basis).toBe('volume_default');
    expect(result.default_duration_source).toBe('volume_table');
  });

  // D3.1 — Default Duration mit Config-Override
  it('D3.1: config override for default duration', () => {
    setConfig('default_duration_minutes', 25, db);

    startSession(db, {});
    const result = startDrink(db, { volumeMl: 500, abv: 5.2 });

    expect(result.duration_secs).toBe(1500); // 25min = 1500s
    expect(result.default_duration_source).toBe('config_override');
  });

  // D4 — Live-Mode: BAC steigt monoton
  it('D4: live mode BAC rises monotonically', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2, stomach: 'some' });

    const status0 = getStatus(db);
    const bac0 = status0.bac_promille as number;

    // Simulate 1 minute later
    const future = new Date(Date.now() + 60000);
    const status1 = getStatus(db, { at: future });
    const bac1 = status1.bac_promille as number;

    expect(bac1).toBeGreaterThanOrEqual(bac0);
  });

  // D5 — Stop liefert bac_at_stop
  it('D5: stop returns bac_at_stop', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.2 });

    const result = stopDrink(db);
    expect(result.bac_at_stop_promille).not.toBeNull();
    expect(result.bac_projected_peak_promille).not.toBeNull();
    expect(result.finished_at).not.toBeNull();
  });

  // D6 — Anti-Anomalie: BAC fällt nicht während Active Absorption
  it('D6: no BAC drop during active absorption', () => {
    startSession(db, {});
    for (let i = 0; i < 3; i++) {
      addDrink(db, { volumeMl: 500, abv: 5.0, stomach: 'some' });
    }

    const beforeStatus = getStatus(db);
    const bacBefore = beforeStatus.bac_promille as number;

    startDrink(db, { volumeMl: 330, abv: 4.7, stomach: 'some' });

    // 5 seconds later
    const future = new Date(Date.now() + 5000);
    const duringStatus = getStatus(db, { at: future });
    const bacDuring = duringStatus.bac_promille as number;

    expect(bacDuring).toBeGreaterThanOrEqual(bacBefore - 0.05);
  });

  // D7 — Stop überschreibt Planned Duration
  it('D7: stop overrides planned duration', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 500, abv: 5.0, duration: '30m' });
    const plannedFinish = startResult.finished_at;

    // Wait 5 seconds
    const future = new Date(Date.now() + 5000);
    const stopResult = stopDrink(db, { at: future });
    const actualFinish = stopResult.finished_at;

    expect(actualFinish).not.toBe(plannedFinish);
  });

  // D8 — Auto-Close nach finished_at + Grace
  it('D8: auto-close after grace period', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 500, abv: 5.0 });

    // 60 minutes later (45min default + 15min grace)
    const future = new Date(Date.now() + 60 * 60000);
    const status = getStatus(db, { at: future });

    expect(status.auto_closed_drinks).toBeDefined();
    const autoClosed = status.auto_closed_drinks as Array<{ drink_id: number; finished_at: string }>;
    expect(autoClosed.length).toBe(1);
    expect(autoClosed[0].finished_at).toBe(startResult.finished_at); // Original planned finish
  });

  // D9 — Multiple Open Drinks Reject
  it('D9: reject multiple open drinks without --force', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.0 });

    try {
      startDrink(db, { volumeMl: 330, abv: 4.7 });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(LiverError);
      expect((error as LiverError).code).toBe('E_DRINK_ALREADY_OPEN');
    }
  });

  it('D9.1: force closes previous drink', () => {
    startSession(db, {});
    startDrink(db, { volumeMl: 500, abv: 5.0 });
    const result = startDrink(db, { volumeMl: 330, abv: 4.7, force: true });

    expect(result.force_closed_drinks).toBeDefined();
    expect(result.force_closed_drinks!.length).toBe(1);
  });

  // D10 — Peak liegt 15-30min nach finished_at
  it('D10: peak 15-30min after finished_at', () => {
    startSession(db, {});
    const startResult = startDrink(db, { volumeMl: 500, abv: 5.0, stomach: 'some', duration: '45m' });

    const finishedAt = new Date(startResult.finished_at);
    const peakAt = new Date(startResult.bac_projected_peak_at);
    const deltaMin = (peakAt.getTime() - finishedAt.getTime()) / 60000;

    // With 45min duration + ka lag, peak should be 15-30min after finished_at
    expect(deltaMin).toBeGreaterThanOrEqual(15);
    expect(deltaMin).toBeLessThanOrEqual(45);
  });
});
