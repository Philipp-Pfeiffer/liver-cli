import type Database from 'better-sqlite3';
import { validateVolume, validateABV, validatePresetName } from '../errors/validation.js';
import { formatISOUTC, nowUTC } from '../time/index.js';
import { UNKNOWN_PRESET } from '../errors/index.js';

export interface PresetData {
  name: string;
  volume_ml: number;
  abv: number;
  created_at: string;
}

export function setPreset(
  db: Database.Database,
  name: string,
  volumeMl: number,
  abv: number,
): { ok: true; name: string } {
  const normalizedName = name.toLowerCase().trim();
  validatePresetName(normalizedName);
  validateVolume(volumeMl);
  validateABV(abv);
  
  db.prepare(
    'INSERT OR REPLACE INTO presets (name, volume_ml, abv, created_at) VALUES (?, ?, ?, ?)'
  ).run(normalizedName, volumeMl, abv, formatISOUTC(nowUTC()));
  
  return { ok: true, name: normalizedName };
}

export function listPresets(db: Database.Database): { items: PresetData[]; count: number } {
  const items = db.prepare('SELECT * FROM presets ORDER BY name').all() as PresetData[];
  return { items, count: items.length };
}

export function getPreset(db: Database.Database, name: string): PresetData {
  const normalizedName = name.toLowerCase().trim();
  const preset = db.prepare('SELECT * FROM presets WHERE name = ?').get(normalizedName) as PresetData | undefined;
  
  if (!preset) {
    throw UNKNOWN_PRESET(normalizedName);
  }
  
  return preset;
}

export function removePreset(
  db: Database.Database,
  name: string,
): { ok: true; name: string } {
  const normalizedName = name.toLowerCase().trim();
  
  getPreset(db, normalizedName);
  
  db.prepare('DELETE FROM presets WHERE name = ?').run(normalizedName);
  
  db.prepare('UPDATE drinks SET preset_name = NULL WHERE preset_name = ?').run(normalizedName);
  
  return { ok: true, name: normalizedName };
}