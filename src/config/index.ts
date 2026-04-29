import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CONFIG_FILE_CORRUPT, INVALID_CONFIG_KEY } from '../errors/index.js';

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
    throw CONFIG_FILE_CORRUPT();
  }
}

function saveConfig(config: LiverConfig): void {
  mkdirSync(LIVER_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function getConfig(key: string): unknown {
  if (!ALLOWED_KEYS.includes(key)) {
    throw INVALID_CONFIG_KEY();
  }
  
  const config = loadConfig();
  return config[key];
}

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

export function setConfig(key: string, value: unknown): void {
  if (!ALLOWED_KEYS.includes(key)) {
    throw INVALID_CONFIG_KEY();
  }
  
  const config = loadConfig();
  config[key] = parseConfigValue(value);
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