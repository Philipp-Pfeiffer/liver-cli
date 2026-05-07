import { EXIT_CODES } from './types.js';
export { EXIT_CODES };
export type { ExitCode, ErrorContext, LiverErrorJSON } from './types.js';

export class LiverError extends Error {
  public readonly code: string;
  public readonly exitCode: ExitCode;
  public readonly hint?: string;
  public readonly context?: ErrorContext;

  constructor(
    code: string,
    message: string,
    exitCode: ExitCode,
    hint?: string,
    context?: ErrorContext,
  ) {
    super(message);
    this.name = 'LiverError';
    this.code = code;
    this.exitCode = exitCode;
    this.hint = hint;
    this.context = context;
  }

  toJSON(): LiverErrorJSON {
    const result: LiverErrorJSON = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    
    if (this.hint) {
      result.error.hint = this.hint;
    }
    
    if (this.context) {
      result.error.context = this.context;
    }
    
    return result;
  }
}

// User Errors (Exit 1)
export const PROFILE_MISSING = (cmd: string) =>
  new LiverError(
    'PROFILE_MISSING',
    'No profile configured. Run `liver profile set ...` first.',
    EXIT_CODES.USER_ERROR,
    'liver profile set --weight 78 --height 184 --sex m --age 22',
    { command: cmd },
  );

export const INVALID_WEIGHT = () =>
  new LiverError('INVALID_WEIGHT', 'Weight must be between 30 and 250 kg.', EXIT_CODES.USER_ERROR);

export const INVALID_HEIGHT = () =>
  new LiverError('INVALID_HEIGHT', 'Height must be between 120 and 230 cm.', EXIT_CODES.USER_ERROR);

export const AGE_OUT_OF_RANGE = () =>
  new LiverError('AGE_OUT_OF_RANGE', 'Age must be between 16 and 120.', EXIT_CODES.USER_ERROR);

export const INVALID_SEX = () =>
  new LiverError('INVALID_SEX', 'Sex must be m, f, or o.', EXIT_CODES.USER_ERROR);

export const INVALID_VOLUME = () =>
  new LiverError('INVALID_VOLUME', 'Volume must be between 1 and 5000 ml.', EXIT_CODES.USER_ERROR);

export const INVALID_ABV = () =>
  new LiverError('INVALID_ABV', 'ABV must be between 0.1 and 100%.', EXIT_CODES.USER_ERROR);

export const INVALID_DURATION = () =>
  new LiverError('INVALID_DURATION', 'Duration must be between 0 and 24h.', EXIT_CODES.USER_ERROR);

export const INVALID_TIME_ORDER = () =>
  new LiverError('INVALID_TIME_ORDER', 'finished_at must be after started_at.', EXIT_CODES.USER_ERROR);

export const INVALID_STOMACH_STATE = () =>
  new LiverError('INVALID_STOMACH_STATE', 'Stomach state must be empty, some, or full.', EXIT_CODES.USER_ERROR);

export const INVALID_PRESET_NAME = () =>
  new LiverError(
    'INVALID_PRESET_NAME',
    'Preset name must be 1-32 characters, lowercase letters, numbers, hyphens, underscores.',
    EXIT_CODES.USER_ERROR,
  );

export const INVALID_SESSION_NAME = () =>
  new LiverError('INVALID_SESSION_NAME', 'Session name must be 0-64 characters.', EXIT_CODES.USER_ERROR);

export const UNKNOWN_PRESET = (name: string) =>
  new LiverError('UNKNOWN_PRESET', `Preset "${name}" does not exist.`, EXIT_CODES.USER_ERROR);

export const BAD_TIME_FORMAT = () =>
  new LiverError('BAD_TIME_FORMAT', 'Invalid time format.', EXIT_CODES.USER_ERROR);

export const CURVE_TOO_LARGE = (suggestedStep: number) =>
  new LiverError(
    'CURVE_TOO_LARGE',
    'Curve would exceed 1000 points. Increase step size.',
    EXIT_CODES.USER_ERROR,
    `Suggested step: ${suggestedStep}m`,
  );

// State Errors (Exit 2)
export const SESSION_ALREADY_ACTIVE = () =>
  new LiverError('SESSION_ALREADY_ACTIVE', 'A session is already active. Use --force to override.', EXIT_CODES.STATE_ERROR);

export const SESSION_NOT_ACTIVE = () =>
  new LiverError('SESSION_NOT_ACTIVE', 'No active session. Start one with `liver session start`.', EXIT_CODES.STATE_ERROR);

export const DRINK_ALREADY_RUNNING = () =>
  new LiverError('DRINK_ALREADY_RUNNING', 'A drink is already running. Stop it first or use --force.', EXIT_CODES.STATE_ERROR);

export const E_DRINK_ALREADY_OPEN = (drinkId: number, elapsedMin: number) =>
  new LiverError(
    'E_DRINK_ALREADY_OPEN',
    `Drink #${drinkId} is already open (running for ${elapsedMin} min). Use 'liver stop' or '--force' to override.`,
    EXIT_CODES.STATE_ERROR,
    `liver stop  # or: liver start --volume ... --force`,
    { drinkId, elapsedMin },
  );

export const E_NO_OPEN_DRINK = () =>
  new LiverError('E_NO_OPEN_DRINK', 'No drink is currently open. Start one with `liver start`.', EXIT_CODES.STATE_ERROR);

export const NO_DRINK_TO_STOP = () =>
  new LiverError('NO_DRINK_TO_STOP', 'No drink is currently running.', EXIT_CODES.STATE_ERROR);

export const TIMESTAMP_OUTSIDE_SESSION = () =>
  new LiverError('TIMESTAMP_OUTSIDE_SESSION', 'Timestamp falls outside any session.', EXIT_CODES.STATE_ERROR);

export const DRINK_NOT_FOUND = (id: number) =>
  new LiverError('DRINK_NOT_FOUND', `Drink with ID ${id} not found.`, EXIT_CODES.STATE_ERROR, undefined, { drinkId: id });

// Internal Errors (Exit 3)
export const WASM_LOAD_FAILED = () =>
  new LiverError('WASM_LOAD_FAILED', 'Failed to load WASM engine.', EXIT_CODES.INTERNAL_ERROR);

export const DB_LOCKED = () =>
  new LiverError('DB_LOCKED', 'Database is locked. Please retry.', EXIT_CODES.INTERNAL_ERROR);

export const ENGINE_PANIC = () =>
  new LiverError('ENGINE_PANIC', 'Engine panic occurred.', EXIT_CODES.INTERNAL_ERROR);

export const SCHEMA_MIGRATION_FAILED = () =>
  new LiverError('SCHEMA_MIGRATION_FAILED', 'Database migration failed.', EXIT_CODES.INTERNAL_ERROR);

// Config Errors (Exit 4)
export const CONFIG_FILE_CORRUPT = () =>
  new LiverError('CONFIG_FILE_CORRUPT', 'Config file is corrupt.', EXIT_CODES.CONFIG_ERROR);

export const INVALID_CONFIG_KEY = () =>
  new LiverError('INVALID_CONFIG_KEY', 'Invalid config key.', EXIT_CODES.CONFIG_ERROR);
export const DATABASE_CORRUPTED = () =>
  new LiverError('DATABASE_CORRUPTED', 'Database file is corrupt. Remove ~/.liver/db.sqlite and retry.', EXIT_CODES.INTERNAL_ERROR);
