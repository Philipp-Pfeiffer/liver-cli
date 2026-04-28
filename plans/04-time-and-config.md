# Phase 4: Time & Config

## Ziel
Zeit-Handling mit chrono-node und Config-System implementieren.

## Schritt 4.1: Time-Utility implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/time/index.ts`:

```typescript
import * as chrono from 'chrono-node';

// Hardcoded Europe/Berlin für Display
const TIMEZONE = 'Europe/Berlin';

export function parseTimestamp(input: string, referenceDate: Date = new Date()): Date {
  const results = chrono.parse(input, referenceDate, { forwardDate: false });
  
  if (results.length === 0) {
    throw new Error(`BAD_TIME_FORMAT`);
  }
  
  const result = results[0];
  let date = result.start.date();
  
  // Wenn reine Uhrzeit ohne Datum, wähle letzten vergangenen Match
  if (!result.start.isCertain('year') && !result.start.isCertain('month') && !result.start.isCertain('day')) {
    const today = new Date(referenceDate);
    today.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    
    if (today > referenceDate) {
      // Zukunft → gestern
      today.setDate(today.getDate() - 1);
    }
    date = today;
  }
  
  return date;
}

export function formatISOUTC(date: Date): string {
  return date.toISOString();
}

export function formatISOLocal(date: Date): string {
  // ISO mit Offset, z.B. 2026-04-28T19:30:00+02:00
  const tzOffset = -date.getTimezoneOffset();
  const absOffset = Math.abs(tzOffset);
  const hours = Math.floor(absOffset / 60).toString().padStart(2, '0');
  const minutes = (absOffset % 60).toString().padStart(2, '0');
  const sign = tzOffset >= 0 ? '+' : '-';
  
  const iso = date.toISOString();
  // Entferne das Z und ersetze durch Offset
  return iso.slice(0, -1) + sign + hours + ':' + minutes;
}

export function formatHumanTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatHumanDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
}

export function nowUTC(): Date {
  return new Date();
}

export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(m|h)$/);
  if (!match) {
    if (input === '0') return 0;
    throw new Error('INVALID_DURATION');
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  let minutes: number;
  if (unit === 'm') {
    minutes = value;
  } else {
    minutes = value * 60;
  }
  
  if (minutes < 0 || minutes > 24 * 60) {
    throw new Error('INVALID_DURATION');
  }
  
  return minutes;
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60);
}
```

## Schritt 4.2: Config-System implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/config/index.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LIVER_DIR = join(homedir(), '.liver');
const CONFIG_PATH = join(LIVER_DIR, 'config');

export interface LiverConfig {
  'zones.sweet_spot_min'?: number;
  'zones.sweet_spot_max'?: number;
  [key: string]: unknown;
}

const ALLOWED_KEYS = [
  'zones.sweet_spot_min',
  'zones.sweet_spot_max',
];

function loadConfig(): LiverConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content) as LiverConfig;
  } catch {
    throw new Error('CONFIG_FILE_CORRUPT');
  }
}

function saveConfig(config: LiverConfig): void {
  mkdirSync(LIVER_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function getConfig(key: string): unknown {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error('INVALID_CONFIG_KEY');
  }
  
  const config = loadConfig();
  return config[key];
}

export function setConfig(key: string, value: unknown): void {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error('INVALID_CONFIG_KEY');
  }
  
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

export function listConfig(): LiverConfig {
  return loadConfig();
}

export function getSweetSpotDefaults(): { min: number; max: number } {
  const config = loadConfig();
  return {
    min: (config['zones.sweet_spot_min'] as number) ?? 0.4,
    max: (config['zones.sweet_spot_max'] as number) ?? 0.8,
  };
}
```

## Schritt 4.3: Time-Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/time.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseTimestamp, parseDuration, formatISOUTC, minutesBetween } from '../../src/time/index.js';

describe('time utilities', () => {
  it('should parse ISO timestamp', () => {
    const date = parseTimestamp('2026-04-28T19:30:00+02:00');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getHours()).toBe(17); // UTC
  });
  
  it('should parse time-only as past', () => {
    const ref = new Date('2026-04-28T12:00:00Z');
    const date = parseTimestamp('10:00', ref);
    // 10:00 ist vor 12:00 → heute
    expect(date.getDate()).toBe(28);
  });
  
  it('should parse future time as yesterday', () => {
    const ref = new Date('2026-04-28T10:00:00Z');
    const date = parseTimestamp('12:00', ref);
    // 12:00 ist nach 10:00 → gestern
    expect(date.getDate()).toBe(27);
  });
  
  it('should parse duration in minutes', () => {
    expect(parseDuration('15m')).toBe(15);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('0')).toBe(0);
  });
  
  it('should reject invalid duration', () => {
    expect(() => parseDuration('25h')).toThrow();
    expect(() => parseDuration('invalid')).toThrow();
  });
  
  it('should format UTC ISO', () => {
    const date = new Date('2026-04-28T17:30:00Z');
    expect(formatISOUTC(date)).toBe('2026-04-28T17:30:00.000Z');
  });
});
```

## Schritt 4.4: Config-Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, setConfig, listConfig, getSweetSpotDefaults } from '../../src/config/index.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_CONFIG = join(homedir(), '.liver', 'config');

beforeEach(() => {
  try { rmSync(TEST_CONFIG); } catch {}
});

afterEach(() => {
  try { rmSync(TEST_CONFIG); } catch {}
});

describe('config', () => {
  it('should set and get config values', () => {
    setConfig('zones.sweet_spot_min', 0.5);
    expect(getConfig('zones.sweet_spot_min')).toBe(0.5);
  });
  
  it('should reject invalid keys', () => {
    expect(() => setConfig('invalid.key', 1)).toThrow();
    expect(() => getConfig('invalid.key')).toThrow();
  });
  
  it('should return default sweet spot values', () => {
    const defaults = getSweetSpotDefaults();
    expect(defaults.min).toBe(0.4);
    expect(defaults.max).toBe(0.8);
  });
  
  it('should use custom sweet spot values', () => {
    setConfig('zones.sweet_spot_min', 0.3);
    setConfig('zones.sweet_spot_max', 0.6);
    const defaults = getSweetSpotDefaults();
    expect(defaults.min).toBe(0.3);
    expect(defaults.max).toBe(0.6);
  });
});
```

## Schritt 4.5: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Zeitstempel-Parsing funktioniert für ISO, Uhrzeit, relative Zeiten
- [ ] Reine Uhrzeit wird korrekt als letzter vergangener Match interpretiert
- [ ] Duration-Parsing akzeptiert Xm und Xh
- [ ] Config-Werte können gesetzt und gelesen werden
- [ ] Ungültige Config-Keys werden abgelehnt
- [ ] Sweet-Spot-Defaults funktionieren
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 5: Error-System** (`05-error-system.md`)
