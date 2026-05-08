import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function createTestDb() {
  const testDir = mkdtempSync(join(tmpdir(), 'liver-test-'));
  return join(testDir, 'db.sqlite');
}

function run(dbPath: string, cmd: string): Record<string, unknown> {
  const result = execSync(`LIVER_DB=${dbPath} node dist/index.js ${cmd}`, { encoding: 'utf-8' });
  return JSON.parse(result);
}

describe('full workflow', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTestDb();
  });
  
  afterEach(() => {
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });
  
  it('should complete typical evening workflow', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    run(dbPath, 'preset set augustiner --vol 500 --abv 5.2');
    run(dbPath, 'preset set shot --vol 40 --abv 40');
    
    const session = run(dbPath, 'session start --name "Maibock" --stomach full');
    expect(session.session_id).toBeGreaterThan(0);
    
    const drink1 = run(dbPath, 'add augustiner');
    expect(drink1.drink_id).toBeGreaterThan(0);
    
    const drink2 = run(dbPath, 'add augustiner --duration 25m');
    expect(drink2.drink_id).toBeGreaterThan(drink1.drink_id as number);
    
    run(dbPath, 'session stomach some');
    
    const start = run(dbPath, 'start shot --force');
    expect(start.drink_id).toBeGreaterThan(0);
    
    const stop = run(dbPath, 'stop');
    expect(stop.drink_id).toBe(start.drink_id);
    
    const status = run(dbPath, 'status');
    expect(status.bac_promille).toBeGreaterThanOrEqual(0);
    expect(status.disclaimer).toBeDefined();
    
    const sober = run(dbPath, 'sober');
    expect(sober.minutes_until_sober).toBeGreaterThanOrEqual(0);
    
    run(dbPath, 'session end');
    
    const stats = run(dbPath, 'stats');
    expect(stats.total_drinks).toBe(3);
    expect(stats.total_sessions).toBe(1);
  });
  
  it('should handle errors correctly', () => {
    expect(() => run(dbPath, 'status')).toThrow();
    
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    
    // Status without session returns no-session JSON (not an error)
    const status = run(dbPath, 'status');
    expect(status.session_id).toBeNull();
    expect(status.warnings).toContain('no_active_session');
    
    expect(() => run(dbPath, 'add unknown')).toThrow();
  });
  
  it('should auto-close sessions', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    run(dbPath, 'preset set beer --vol 500 --abv 5');
    
    const session = run(dbPath, 'session start');
    run(dbPath, 'add beer');
    run(dbPath, 'session end');
    
    const session2 = run(dbPath, 'session start');
    expect(session2.session_id).not.toBe(session.session_id);
  });
});