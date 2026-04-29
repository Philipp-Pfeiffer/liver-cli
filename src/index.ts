import { Command } from 'commander';
import { initDb } from './db/index.js';
import { setProfile, getProfile } from './commands/profile.js';
import { setPreset, listPresets, getPreset, removePreset } from './commands/preset.js';
import { startSession, endSession, listSessions, getSession, setStomachState, getActiveSession, renameSession } from './commands/session.js';
import { addDrink, startDrink, stopDrink, listDrinks, removeDrink } from './commands/drink.js';
import { getStatus, getBACAt, getSober, getCurve } from './commands/compute.js';
import { getStats } from './commands/stats.js';
import { getConfig, setConfig, listConfig } from './config/index.js';
import { performAutoClose } from './commands/auto-close.js';
import { configureOutput, outputSuccess, outputError, logVerbose } from './output/index.js';
import { parseTimestamp } from './time/index.js';
import { LiverError, PROFILE_MISSING, SESSION_NOT_ACTIVE, INVALID_VOLUME, INVALID_ABV } from './errors/index.js';
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

function handleCommand(fn: () => Record<string, unknown> | void, cmd: Command): void {
  try {
    configureOutput(getOutputOptions(cmd));

    const db = initDb();
    logVerbose('Database initialized');

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

    const message = error instanceof Error ? error.message : String(error);

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
        throw PROFILE_MISSING('profile show');
      }
      return profile;
    }, cmd);
  });

// Preset Commands
const presetCmd = program.command('preset');

presetCmd
  .command('set <name>')
  .description('Set a drink preset')
  .requiredOption('--vol <ml>', 'Volume in ml', parseFloat)
  .requiredOption('--abv <pct>', 'ABV in percent', parseFloat)
  .action((name, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = setPreset(db, name, options.vol, options.abv);
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

sessionCmd
  .command('rename <id>')
  .description('Rename a session')
  .requiredOption('--name <str>', 'New name')
  .action((id, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = renameSession(db, parseInt(id, 10), options.name);
      db.close();
      return result;
    }, cmd);
  });

// Drink Commands
program
  .command('add [preset]')
  .description('Add a drink')
  .option('--vol <ml>', 'Volume in ml', parseFloat)
  .option('--abv <pct>', 'ABV in percent', parseFloat)
  .option('--at <T>', 'Time')
  .option('--duration <Xm|Xh>', 'Duration')
  .option('--stomach <empty|some|full>', 'Stomach state')
  .option('--session <new>', 'Create new session for backdated drink')
  .option('--name <str>', 'Session name (with --session new)')
  .action((preset, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      let volumeMl: number;
      let abv: number;
      let presetName: string | undefined;
      
      if (preset) {
        if (options.vol !== undefined || options.abv !== undefined) {
          db.close();
          throw INVALID_VOLUME();
        }
        const presetData = getPreset(db, preset);
        volumeMl = presetData.volume_ml;
        abv = presetData.abv;
        presetName = presetData.name;
      } else if (options.vol !== undefined && options.abv !== undefined) {
        volumeMl = options.vol;
        abv = options.abv;
      } else {
        db.close();
        throw INVALID_VOLUME();
      }
      
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = addDrink(db, {
        volumeMl,
        abv,
        at,
        duration: options.duration,
        presetName,
        stomach: options.stomach,
        sessionNew: options.session === 'new',
        sessionName: options.name,
      });
      db.close();
      return result;
    }, cmd);
  });

program
  .command('start [preset]')
  .description('Start drinking')
  .option('--vol <ml>', 'Volume in ml', parseFloat)
  .option('--abv <pct>', 'ABV in percent', parseFloat)
  .option('--at <T>', 'Start time')
  .option('--duration <Xm|Xh>', 'Duration')
  .option('--stomach <empty|some|full>', 'Stomach state')
  .option('--force', 'Force start (stop current drink)')
  .action((preset, options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      let volumeMl: number;
      let abv: number;
      let presetName: string | undefined;
      
      if (preset) {
        if (options.vol !== undefined || options.abv !== undefined) {
          db.close();
          throw INVALID_VOLUME();
        }
        const presetData = getPreset(db, preset);
        volumeMl = presetData.volume_ml;
        abv = presetData.abv;
        presetName = presetData.name;
      } else if (options.vol !== undefined && options.abv !== undefined) {
        volumeMl = options.vol;
        abv = options.abv;
      } else {
        db.close();
        throw INVALID_VOLUME();
      }
      
      const at = options.at ? parseTimestamp(options.at) : undefined;
      const result = startDrink(db, {
        volumeMl,
        abv,
        presetName,
        force: options.force,
        at,
        duration: options.duration,
        stomach: options.stomach,
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

const drinkCmd = program.command('drink');

drinkCmd
  .command('list')
  .description('List all drinks')
  .action((_options, cmd) => {
    handleCommand(() => {
      const db = initDb();
      const result = listDrinks(db);
      db.close();
      return result;
    }, cmd);
  });

drinkCmd
  .command('rm <id>')
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