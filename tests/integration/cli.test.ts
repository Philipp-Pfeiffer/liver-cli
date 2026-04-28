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

describe('CLI integration', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTestDb();
  });

  afterEach(() => {
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  it('should show version', () => {
    const result = execSync('LIVER_DB=/nonexistent node dist/index.js --version', { encoding: 'utf-8' });
    expect(result.trim()).toContain('0.1.0');
  });

  it('should set profile', () => {
    const result = run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    expect(result.ok).toBe(true);
  });

  it('should show profile', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    const result = run(dbPath, 'profile show');
    expect(result.weight_kg).toBe(78);
  });

  it('should save preset', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    const result = run(dbPath, 'preset save augustiner --vol 500 --abv 5.2');
    expect(result.ok).toBe(true);
  });

  it('should start session', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    const result = run(dbPath, 'session start --name Test --stomach full');
    expect(result.session_id).toBeGreaterThan(0);
  });

  it('should add drink', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    run(dbPath, 'session start --name Test --stomach full');
    run(dbPath, 'preset save augustiner --vol 500 --abv 5.2');
    const result = run(dbPath, 'add augustiner');
    expect(result.drink_id).toBeGreaterThan(0);
  });

  it('should show status', () => {
    run(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    run(dbPath, 'session start --name Test --stomach full');
    run(dbPath, 'preset save augustiner --vol 500 --abv 5.2');
    run(dbPath, 'add augustiner');
    const result = run(dbPath, 'status');
    expect(result.bac_promille).toBeGreaterThan(0);
  });
});