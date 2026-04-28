# Phase 12: CLI Integration

## Ziel
Alle Commands in Commander.js integrieren, Entry Point vervollständigen.

## Schritt 12.1: CLI Entry Point implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/index.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { initDb } from './db/index.js';
import { setProfile, getProfile } from './commands/profile.js';
import { savePreset, listPresets, getPreset, removePreset } from './commands/preset.js';
import { startSession, endSession, listSessions, getSession, setStomachState } from './commands/session.js';
import { addDrink, startDrink, stopDrink, listDrinks, removeDrink } from './commands/drink.js';
import { getStatus, getBACAt, getSober, getCurve } from './commands/compute.js';
import { getStats } from './commands/stats.js';
import { getConfig, setConfig, listConfig } from './config/index.js';
import { performAutoClose } from './commands/auto-close.js';
import { configureOutput, outputSuccess, outputError, logVerbose } from './output/index.js';
import { parseTimestamp, parseDuration, formatISOLocal, nowUTC } from './time/index.js';
import { LiverError } from './errors/index.js';
import type { OutputOptions } from './output/index.js';
import type { BACFormula } from './engine/types.js';

const program = new Command();

program
  .name('liver')
  .description('BAC tracking CLI')
  .version('0.1.0')
  .option('--human', 'Human-readable output')
  .option('--no-color', 'Disable colors')
  .option('-v, --verbose', 'Verbose logging')
  .option('--formula <formula>', 'BAC formula override (watson|widmark)');

// Helper to get common options
function getOutputOptions(cmd: Command): OutputOptions {
  const opts = cmd.optsWithGlobals();
  return {
    human: opts.human,
    noColor: opts.noColor,
    verbose: opts.verbose,
  };
}

function getFormula(cmd: Command): BACFormula | undefined {
  const opts = cmd.optsWithGlobals();
  return opts.formula;
}

// Error handler wrapper
function handleCommand(fn: () => Record<string, unknown> | void, cmd: Command): void {
  try {
    configureOutput(getOutputOptions(cmd));
    
    const db = initDb();
    logVerbose('Database initialized');
    
    // Perform auto-close check
    const closedSession = performAutoClose(db);
    
    const result = fn();
    
    const output: Record<string, unknown> = result ?? { ok: true };
    if (closedSession) {
      output.auto_closed_session = closedSession;
    }
    
    outputSuccess(output, getOutputOptions(cmd));
    
    db.close();
    process.exit(0);
  } catch (error) {
    configureOutput(getOutputOptions(cmd));
    
    if (error instanceof LiverError) {
      outputError(error, getOutputOptions(cmd));
      process.exit(error.exitCode);
    }
    
    // Handle specific string errors
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.startsWith('CURVE_TOO_LARGE:')) {
      const suggestedStep = parseInt(message.split(':')[1]!, 10);
      const { CURVE_TOO_LARGE } = await import('./errors/index.js');
      const err = CURVE_TOO_LARGE(suggestedStep);
      outputError(err, getOutputOptions(cmd));
      process.exit(err.exitCode);
    }
    
    if (message === 'SESSION_NOT_ACTIVE') {
      const { SESSION_NOT_ACTIVE } = await import('./errors/index.js');
      const err = SESSION_NOT_ACTIVE();
      outputError(err, getOutputOptions(cmd));
      process.exit(err.exitCode);
    }
    
    if (message === 'INVALID_CONFIG_KEY') {
      const { INVALID_CONFIG_KEY } = await import('./errors/index.js');
      const err = INVALID_CONFIG_KEY();
      outputError(err, getOutputOptions(cmd));
      process.exit(err.exitCode);
    }
    
    if (message === 'CONFIG_FILE_CORRUPT') {
      const { CONFIG_FILE_CORRUPT } = await import('./errors/index.js');
      const err = CONFIG_FILE_CORRUPT();
      outputError(err, getOutputOptions(cmd));
      process.exit(err.exitCode);
    }
    
    // Unknown error
    console.error(JSON.stringify({
      error: {
        code: 'UNKNOWN_ERROR',
        message: message,
      },
    }));
    process.exit(3);
  }
}

// Profile Commands
const profileCmd = program.command('profile');

profileCmd
  .command('set')
  .description('Set your profile')
  .requiredOption('--weight <kg>', 'Weight in kg', parseFloat)
  .requiredOption('--height <cm>', 'Height in cm', parseFloat)
  .requiredOption('--sex <m|f|o>', 'Sex')
  .requiredOption('--age <years>', 'Age', parseInt)
  .option('--formula <watson|widmark>', 'Preferred formula')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = setProfile(db, options.weight, options.height, options.sex, options.age, options.formula);
      db.close();
      return result;
    }, cmd);
  });

profileCmd
  .command('show')
  .description('Show your profile')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const profile = getProfile(db);
      db.close();
      if (!profile) {
        const { PROFILE_MISSING } = require('./errors/index.js');
        throw PROFILE_MISSING('profile show');
      }
      return profile;
    }, cmd);
  });

// Preset Commands
const presetCmd = program.command('preset');

presetCmd
  .command('save <name>')
  .description('Save a drink preset')
  .requiredOption('--vol <ml>', 'Volume in ml', parseFloat)
  .requiredOption('--abv <pct>', 'ABV in percent', parseFloat)
  .action((name, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = savePreset(db, name, options.vol, options.abv);
      db.close();
      return result;
    }, cmd);
  });

presetCmd
  .command('list')
  .description('List all presets')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = listPresets(db);
      db.close();
      return result;
    }, cmd);
  });

presetCmd
  .command('show <name>')
  .description('Show a preset')
  .action((name, _options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = getPreset(db, name);
      db.close();
      return result;
    }, cmd);
  });

presetCmd
  .command('rm <name>')
  .description('Remove a preset')
  .action((name, _options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = removePreset(db, name);
      db.close();
      return result;
    }, cmd);
  });

// Session Commands
const sessionCmd = program.command('session');

sessionCmd
  .command('start')
  .description('Start a drinking session')
  .option('--name <str>', 'Session name')
  .option('--stomach <empty|some|full>', 'Stomach state', 'some')
  .option('--at <T>', 'Start time')
  .option('--force', 'Force start (end current session)')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = startSession(db, {
        name: options.name,
        stomach: options.stomach,
        at,
        force: options.force,
      });
      db.close();
      return result;
    }, cmd);
  });

sessionCmd
  .command('end')
  .description('End the current session')
  .option('--at <T>', 'End time')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = endSession(db, { at });
      db.close();
      return result;
    }, cmd);
  });

sessionCmd
  .command('show')
  .description('Show current session')
  .option('--id <id>', 'Session ID', parseInt)
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      let session;
      if (options.id) {
        session = getSession(db, options.id);
      } else {
        session = getActiveSession(db);
      }
      db.close();
      if (!session) {
        const { SESSION_NOT_ACTIVE } = require('./errors/index.js');
        throw SESSION_NOT_ACTIVE();
      }
      return session;
    }, cmd);
  });

sessionCmd
  .command('list')
  .description('List sessions')
  .option('--year <YYYY>', 'Filter by year')
  .option('--month <YYYY-MM>', 'Filter by month')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = listSessions(db, { year: options.year, month: options.month });
      db.close();
      return result;
    }, cmd);
  });

sessionCmd
  .command('stomach <state>')
  .description('Set stomach state')
  .option('--at <T>', 'Time')
  .action((state, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = setStomachState(db, state, { at });
      db.close();
      return result;
    }, cmd);
  });

// Drink Commands
program
  .command('add <preset>')
  .description('Add a drink from preset')
  .option('--at <T>', 'Time')
  .option('--duration <Xm|Xh>', 'Duration')
  .action((preset, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const presetData = getPreset(db, preset);
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = addDrink(db, {
        volumeMl: presetData.volume_ml,
        abv: presetData.abv,
        at,
        duration: options.duration,
        presetName: presetData.name,
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('add-raw')
  .description('Add a drink with explicit volume and ABV')
  .requiredOption('--vol <ml>', 'Volume in ml', parseFloat)
  .requiredOption('--abv <pct>', 'ABV in percent', parseFloat)
  .option('--at <T>', 'Time')
  .option('--duration <Xm|Xh>', 'Duration')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = addDrink(db, {
        volumeMl: options.vol,
        abv: options.abv,
        at,
        duration: options.duration,
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('start <preset>')
  .description('Start drinking a preset')
  .action((preset, _options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const presetData = getPreset(db, preset);
      const result = startDrink(db, {
        volumeMl: presetData.volume_ml,
        abv: presetData.abv,
        presetName: presetData.name,
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('start-raw')
  .description('Start drinking with explicit volume and ABV')
  .requiredOption('--vol <ml>', 'Volume in ml', parseFloat)
  .requiredOption('--abv <pct>', 'ABV in percent', parseFloat)
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = startDrink(db, {
        volumeMl: options.vol,
        abv: options.abv,
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('stop')
  .description('Stop current drink')
  .option('--at <T>', 'Time')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = stopDrink(db, { at });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('drink:list')
  .description('List all drinks')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = listDrinks(db);
      db.close();
      return result;
    }, cmd);
  });

program
  .command('drink:rm <id>')
  .description('Remove a drink')
  .action((id, _options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = removeDrink(db, parseInt(id, 10));
      db.close();
      return result;
    }, cmd);
  });

// Computation Commands
program
  .command('status')
  .description('Current BAC status')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = getStatus(db, { formula: getFormula(cmd) });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('bac')
  .description('BAC at specific time')
  .requiredOption('--at <T>', 'Time')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const at = parseTimestamp(options.at);
      const result = getBACAt(db, at, { formula: getFormula(cmd) });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('curve')
  .description('BAC curve')
  .option('--from <T>', 'Start time')
  .option('--to <T>', 'End time')
  .option('--step <minutes>', 'Step size in minutes', parseInt)
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const from = options.from ? parseTimestamp(options.from) : undefined;
      const to = options.to ? parseTimestamp(options.to) : undefined;
      const result = getCurve(db, {
        from,
        to,
        step: options.step,
        formula: getFormula(cmd),
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('sober')
  .description('Time until sober')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = getSober(db, { formula: getFormula(cmd) });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('stats')
  .description('Drinking statistics')
  .option('--month <YYYY-MM>', 'Month')
  .option('--year <YYYY>', 'Year')
  .option('--from <T>', 'From date')
  .option('--to <T>', 'To date')
  .option('--all', 'All time')
  .action((options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const from = options.from ? parseTimestamp(options.from) : undefined;
      const to = options.to ? parseTimestamp(options.to) : undefined;
      const result = getStats(db, {
        month: options.month,
        year: options.year,
        from,
        to,
        all: options.all,
        formula: getFormula(cmd),
      });
      db.close();
      return result;
    }, cmd);
  });

// Config Commands
const configCmd = program.command('config');

configCmd
  .command('set <key> <value>')
  .description('Set config value')
  .action((key, value, _options, cmd) => {
    handleCommand(() => {
      setConfig(key, value);
      return { ok: true };
    }, cmd);
  });

configCmd
  .command('get <key>')
  .description('Get config value')
  .action((key, _options, cmd) => {
    handleCommand(() => {
      const value = getConfig(key);
      return { key, value };
    }, cmd);
  });

configCmd
  .command('list')
  .description('List all config')
  .action((_options, cmd) => {
    handleCommand(() => {
      const config = listConfig();
      return config;
    }, cmd);
  });

program.parse();
```

**WICHTIG**: Korrigiere die dynamischen Imports, da wir kein `await` im Top-Level ohne async haben wollen. Da `handleCommand` async sein müsste für `await import`, ändere es zu synchronen Requires oder füge eine sync-Version hinzu. Da wir ESM nutzen, verwende statische Imports für alle Error-Codes oben im File.

Korrigierte Version mit statischen Imports:

Füge oben in `src/index.ts` hinzu:
```typescript
import {
  PROFILE_MISSING,
  SESSION_NOT_ACTIVE,
  CURVE_TOO_LARGE,
  INVALID_CONFIG_KEY,
  CONFIG_FILE_CORRUPT,
} from './errors/index.js';
```

Und ersetze die dynamischen Imports in `handleCommand` durch die statischen.

## Schritt 12.2: Integration Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/integration/cli.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LIVER_DB = join(homedir(), '.liver', 'db.sqlite');

describe('CLI integration', () => {
  beforeAll(() => {
    // Clean up test database
    if (existsSync(LIVER_DB)) {
      rmSync(LIVER_DB);
    }
  });
  
  it('should show version', () => {
    const result = execSync('node dist/index.js --version', { encoding: 'utf-8' });
    expect(result.trim()).toContain('0.1.0');
  });
  
  it('should set profile', () => {
    const result = execSync(
      'node dist/index.js profile set --weight 78 --height 184 --sex m --age 22',
      { encoding: 'utf-8' },
    );
    const json = JSON.parse(result);
    expect(json.ok).toBe(true);
  });
  
  it('should show profile', () => {
    const result = execSync('node dist/index.js profile show', { encoding: 'utf-8' });
    const json = JSON.parse(result);
    expect(json.weight_kg).toBe(78);
  });
  
  it('should save preset', () => {
    const result = execSync(
      'node dist/index.js preset save augustiner --vol 500 --abv 5.2',
      { encoding: 'utf-8' },
    );
    const json = JSON.parse(result);
    expect(json.ok).toBe(true);
  });
  
  it('should start session', () => {
    const result = execSync(
      'node dist/index.js session start --name Test --stomach full',
      { encoding: 'utf-8' },
    );
    const json = JSON.parse(result);
    expect(json.session_id).toBeGreaterThan(0);
  });
  
  it('should add drink', () => {
    const result = execSync(
      'node dist/index.js add augustiner',
      { encoding: 'utf-8' },
    );
    const json = JSON.parse(result);
    expect(json.drink_id).toBeGreaterThan(0);
  });
  
  it('should show status', () => {
    const result = execSync('node dist/index.js status', { encoding: 'utf-8' });
    const json = JSON.parse(result);
    expect(json.bac_promille).toBeGreaterThan(0);
  });
});
```

## Schritt 12.3: Build und Test

```bash
npm run build
npm run test
```

## Erfolgskriterien

- [ ] Alle Commands sind über CLI aufrufbar
- [ ] `--help` zeigt korrekte Hilfe
- [ ] `--version` zeigt Version
- [ ] Globale Flags funktionieren
- [ ] JSON-Output ist valide
- [ ] Error-Codes und Exit-Codes sind korrekt
- [ ] Integration-Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 13: Testing** (`13-testing.md`)
