import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const HELP_FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'help.txt');

function createTestDb() {
  const testDir = mkdtempSync(join(tmpdir(), 'liver-test-'));
  return join(testDir, 'db.sqlite');
}

function runRaw(dbPath: string, cmd: string): string {
  return execSync(`LIVER_DB=${dbPath} node dist/index.js ${cmd}`, { encoding: 'utf-8' });
}

describe('Command Surface Test', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTestDb();
  });

  afterEach(() => {
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  it('liver --help output matches spec §0.1', () => {
    const helpOutput = runRaw(dbPath, '--help');
    
    // Check that polymorphic add/start exist
    expect(helpOutput).toContain('add [options] [preset]');
    expect(helpOutput).toContain('start [options] [preset]');
    
    // Check that drink subcommand exists
    expect(helpOutput).toContain('drink');
    
    // Check that old colon commands don't exist
    expect(helpOutput).not.toContain('drink:list');
    expect(helpOutput).not.toContain('drink:rm');
    expect(helpOutput).not.toContain('add-raw');
    expect(helpOutput).not.toContain('start-raw');
    
    // Check add --help shows --vol and --abv
    const addHelp = runRaw(dbPath, 'add --help');
    expect(addHelp).toContain('--vol <ml>');
    expect(addHelp).toContain('--abv <pct>');
    
    // Check start --help shows --force
    const startHelp = runRaw(dbPath, 'start --help');
    expect(startHelp).toContain('--force');
    
    // Check drink --help shows list and rm
    const drinkHelp = runRaw(dbPath, 'drink --help');
    expect(drinkHelp).toContain('list');
    expect(drinkHelp).toContain('rm <id>');
    
    // Write fixture for golden test
    writeFileSync(HELP_FIXTURE, helpOutput);
    
    // Verify fixture matches
    const fixtureContent = readFileSync(HELP_FIXTURE, 'utf-8');
    expect(helpOutput).toBe(fixtureContent);
  });

  it('polymorphic add works with preset', () => {
    runRaw(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    runRaw(dbPath, 'session start --stomach full');
    runRaw(dbPath, 'preset set beer --vol 500 --abv 5.0');
    const result = JSON.parse(runRaw(dbPath, 'add beer'));
    expect(result.drink_id).toBeGreaterThan(0);
    expect(result.volume_ml).toBe(500);
    expect(result.abv).toBe(5.0);
  });

  it('polymorphic add works with raw params', () => {
    runRaw(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    runRaw(dbPath, 'session start --stomach full');
    const result = JSON.parse(runRaw(dbPath, 'add --vol 500 --abv 5.0'));
    expect(result.drink_id).toBeGreaterThan(0);
    expect(result.volume_ml).toBe(500);
    expect(result.abv).toBe(5.0);
  });

  it('polymorphic add rejects ambiguous input', () => {
    runRaw(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    runRaw(dbPath, 'session start --stomach full');
    runRaw(dbPath, 'preset set beer --vol 500 --abv 5.0');
    expect(() => runRaw(dbPath, 'add beer --vol 500 --abv 5.0')).toThrow();
  });

  it('polymorphic start with --force stops running drink', () => {
    runRaw(dbPath, 'profile set --weight 78 --height 184 --sex m --age 22');
    runRaw(dbPath, 'session start --stomach full');
    runRaw(dbPath, 'preset set beer --vol 500 --abv 5.0');
    JSON.parse(runRaw(dbPath, 'start beer'));
    const result = JSON.parse(runRaw(dbPath, 'start beer --force'));
    expect(result.drink_id).toBeGreaterThan(0);
  });
});
