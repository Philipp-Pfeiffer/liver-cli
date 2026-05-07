import type Database from 'better-sqlite3';
import { initDb } from '../db/index.js';
import { INVALID_CONFIG_KEY } from '../errors/index.js';

export interface LiverConfig {
  'zones.sweet_spot_min'?: number;
  'zones.sweet_spot_max'?: number;
  'engine.default_formula'?: string;
  'default_duration_minutes'?: number;
  'auto_close_grace_minutes'?: number;
  [key: string]: unknown;
}

const ALLOWED_KEYS = [
  'zones.sweet_spot_min',
  'zones.sweet_spot_max',
  'engine.default_formula',
  'default_duration_minutes',
  'auto_close_grace_minutes',
];

function parseConfigValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeConfigValue(value: unknown): string {
  return JSON.stringify(value);
}

export function getConfig(key: string, db?: Database.Database): unknown {
  if (!ALLOWED_KEYS.includes(key)) {
    throw INVALID_CONFIG_KEY();
  }
  
  const shouldClose = !db;
  const conn = db ?? initDb();
  try {
    const row = conn.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? parseConfigValue(row.value) : undefined;
  } finally {
    if (shouldClose) {
      conn.close();
    }
  }
}

export function setConfig(key: string, value: unknown, db?: Database.Database): void {
  if (!ALLOWED_KEYS.includes(key)) {
    throw INVALID_CONFIG_KEY();
  }
  
  // Validate engine.default_formula
  if (key === 'engine.default_formula' && value !== undefined && value !== null) {
    const formula = String(value);
    if (!['watson', 'widmark'].includes(formula)) {
      throw INVALID_CONFIG_KEY();
    }
  }

  // Validate numeric config keys
  if ((key === 'default_duration_minutes' || key === 'auto_close_grace_minutes') && value !== undefined && value !== null) {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof num !== 'number' || isNaN(num) || num < 0 || num > 24 * 60) {
      throw INVALID_CONFIG_KEY();
    }
  }
  
  // Try to parse string values as JSON (numbers, booleans, etc.)
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string if JSON parse fails
    }
  }
  
  const shouldClose = !db;
  const conn = db ?? initDb();
  try {
    conn.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(
      key,
      serializeConfigValue(parsedValue),
    );
  } finally {
    if (shouldClose) {
      conn.close();
    }
  }
}

export function listConfig(db?: Database.Database): LiverConfig {
  const shouldClose = !db;
  const conn = db ?? initDb();
  try {
    const rows = conn.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[];
    const config: LiverConfig = {};
    for (const row of rows) {
      config[row.key] = parseConfigValue(row.value);
    }
    return config;
  } finally {
    if (shouldClose) {
      conn.close();
    }
  }
}

export function getSweetSpotDefaults(db?: Database.Database): { min: number; max: number } {
  const shouldClose = !db;
  const conn = db ?? initDb();
  try {
    const rows = conn.prepare("SELECT key, value FROM config WHERE key LIKE 'zones.%'").all() as { key: string; value: string }[];
    const config: Record<string, number> = {};
    for (const row of rows) {
      const val = parseConfigValue(row.value);
      if (typeof val === 'number') {
        config[row.key] = val;
      }
    }
    return {
      min: config['zones.sweet_spot_min'] ?? 0.4,
      max: config['zones.sweet_spot_max'] ?? 0.8,
    };
  } finally {
    if (shouldClose) {
      conn.close();
    }
  }
}
