# Phase 5: Error-System

## Ziel
Einheitliche Error-Klassen, Exit-Codes, und Validierungs-Utilities implementieren.

## Schritt 5.1: Error-Klassen definieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/errors/types.ts`:

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  USER_ERROR: 1,
  STATE_ERROR: 2,
  INTERNAL_ERROR: 3,
  CONFIG_ERROR: 4,
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];

export interface ErrorContext {
  command?: string;
  [key: string]: unknown;
}

export interface LiverErrorJSON {
  error: {
    code: string;
    message: string;
    hint?: string;
    context?: ErrorContext;
  };
}
```

## Schritt 5.2: Base Error Klasse

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/errors/index.ts`:

```typescript
import type { ExitCode, ErrorContext, LiverErrorJSON } from './types.js';
import { EXIT_CODES } from './types.js';

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
```

## Schritt 5.3: Validierungs-Utilities

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/errors/validation.ts`:

```typescript
import {
  INVALID_WEIGHT,
  INVALID_HEIGHT,
  AGE_OUT_OF_RANGE,
  INVALID_SEX,
  INVALID_VOLUME,
  INVALID_ABV,
  INVALID_DURATION,
  INVALID_STOMACH_STATE,
  INVALID_PRESET_NAME,
  INVALID_SESSION_NAME,
} from './index.js';

export function validateWeight(weight: number): void {
  if (weight < 30 || weight > 250) throw INVALID_WEIGHT();
}

export function validateHeight(height: number): void {
  if (height < 120 || height > 230) throw INVALID_HEIGHT();
}

export function validateAge(age: number): void {
  if (age < 16 || age > 120) throw AGE_OUT_OF_RANGE();
}

export function validateSex(sex: string): void {
  if (!['m', 'f', 'o'].includes(sex)) throw INVALID_SEX();
}

export function validateVolume(volume: number): void {
  if (volume <= 0 || volume > 5000) throw INVALID_VOLUME();
}

export function validateABV(abv: number): void {
  if (abv <= 0 || abv > 100) throw INVALID_ABV();
}

export function validateDuration(minutes: number): void {
  if (minutes < 0 || minutes > 24 * 60) throw INVALID_DURATION();
}

export function validateStomachState(state: string): void {
  if (!['empty', 'some', 'full'].includes(state)) throw INVALID_STOMACH_STATE();
}

export function validatePresetName(name: string): void {
  if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw INVALID_PRESET_NAME();
}

export function validateSessionName(name: string | undefined): void {
  if (name !== undefined && name.length > 64) throw INVALID_SESSION_NAME();
}
```

## Schritt 5.4: Error-Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LiverError, PROFILE_MISSING, EXIT_CODES } from '../../src/errors/index.js';
import {
  validateWeight,
  validateHeight,
  validateAge,
  validateSex,
  validateVolume,
  validateABV,
} from '../../src/errors/validation.js';

describe('errors', () => {
  it('should create error with correct properties', () => {
    const err = PROFILE_MISSING('status');
    expect(err.code).toBe('PROFILE_MISSING');
    expect(err.exitCode).toBe(EXIT_CODES.USER_ERROR);
    expect(err.hint).toContain('profile set');
    expect(err.context).toEqual({ command: 'status' });
  });
  
  it('should serialize to JSON', () => {
    const err = PROFILE_MISSING('status');
    const json = err.toJSON();
    expect(json.error.code).toBe('PROFILE_MISSING');
    expect(json.error.message).toContain('No profile configured');
  });
  
  it('should validate weight', () => {
    expect(() => validateWeight(70)).not.toThrow();
    expect(() => validateWeight(20)).toThrow();
    expect(() => validateWeight(300)).toThrow();
  });
  
  it('should validate height', () => {
    expect(() => validateHeight(180)).not.toThrow();
    expect(() => validateHeight(100)).toThrow();
  });
  
  it('should validate age', () => {
    expect(() => validateAge(25)).not.toThrow();
    expect(() => validateAge(10)).toThrow();
  });
  
  it('should validate sex', () => {
    expect(() => validateSex('m')).not.toThrow();
    expect(() => validateSex('f')).not.toThrow();
    expect(() => validateSex('o')).not.toThrow();
    expect(() => validateSex('x')).toThrow();
  });
  
  it('should validate volume', () => {
    expect(() => validateVolume(500)).not.toThrow();
    expect(() => validateVolume(0)).toThrow();
    expect(() => validateVolume(5001)).toThrow();
  });
  
  it('should validate ABV', () => {
    expect(() => validateABV(5.2)).not.toThrow();
    expect(() => validateABV(0)).toThrow();
    expect(() => validateABV(101)).toThrow();
  });
});
```

## Schritt 5.5: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Alle Error-Klassen haben korrekte Exit-Codes
- [ ] Error-JSON enthält code, message, hint, context
- [ ] Validierungs-Functions werfen korrekte Errors
- [ ] Alle Error-Codes aus der Spec sind implementiert
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 6: Profile & Presets** (`06-profile-presets.md`)
