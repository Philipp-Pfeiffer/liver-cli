# Phase 6: Profile & Presets

## Ziel
Profile- und Preset-Management Commands implementieren.

## Schritt 6.1: Profile Commands implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/profile.ts`:

```typescript
import type Database from 'better-sqlite3';
import {
  validateWeight,
  validateHeight,
  validateAge,
  validateSex,
} from '../errors/validation.js';
import { formatISOUTC } from '../time/index.js';

export interface ProfileData {
  weight_kg: number;
  height_cm: number;
  sex: string;
  age: number;
  preferred_formula: string | null;
}

export function setProfile(
  db: Database.Database,
  weightKg: number,
  heightCm: number,
  sex: string,
  age: number,
  formula?: string,
): { ok: true } {
  validateWeight(weightKg);
  validateHeight(heightCm);
  validateAge(age);
  validateSex(sex);
  
  if (formula && !['watson', 'widmark'].includes(formula)) {
    throw new Error('INVALID_CONFIG_KEY');
  }
  
  // Delete existing profile (singleton)
  db.prepare('DELETE FROM profile').run();
  
  // Insert new profile
  db.prepare(
    'INSERT INTO profile (weight_kg, height_cm, sex, age, preferred_formula) VALUES (?, ?, ?, ?, ?)'
  ).run(weightKg, heightCm, sex, age, formula ?? null);
  
  return { ok: true };
}

export function getProfile(db: Database.Database): ProfileData | null {
  const row = db.prepare('SELECT * FROM profile LIMIT 1').get() as ProfileData | undefined;
  return row ?? null;
}

export function requireProfile(db: Database.Database, command: string): ProfileData {
  const profile = getProfile(db);
  if (!profile) {
    const { PROFILE_MISSING } = await import('../errors/index.js');
    throw PROFILE_MISSING(command);
  }
  return profile;
}
```

**WICHTIG**: Da wir ESM nutzen und top-level await vermeiden wollen, korrigiere `requireProfile`:

```typescript
import { PROFILE_MISSING } from '../errors/index.js';

export function requireProfile(db: Database.Database, command: string): ProfileData {
  const profile = getProfile(db);
  if (!profile) {
    throw PROFILE_MISSING(command);
  }
  return profile;
}
```

## Schritt 6.2: Preset Commands implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/commands/preset.ts`:

```typescript
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

export function savePreset(
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
  
  // Verify exists
  getPreset(db, normalizedName);
  
  db.prepare('DELETE FROM presets WHERE name = ?').run(normalizedName);
  
  // Set preset_name to NULL for drinks using this preset
  db.prepare('UPDATE drinks SET preset_name = NULL WHERE preset_name = ?').run(normalizedName);
  
  return { ok: true, name: normalizedName };
}
```

## Schritt 6.3: Profile & Preset Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/profile.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { setProfile, getProfile, requireProfile } from '../../src/commands/profile.js';

describe('profile commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should set and get profile', () => {
    setProfile(db, 78, 184, 'm', 22, 'watson');
    const profile = getProfile(db);
    expect(profile).not.toBeNull();
    expect(profile?.weight_kg).toBe(78);
    expect(profile?.height_cm).toBe(184);
    expect(profile?.sex).toBe('m');
    expect(profile?.age).toBe(22);
    expect(profile?.preferred_formula).toBe('watson');
  });
  
  it('should require profile', () => {
    expect(() => requireProfile(db, 'status')).toThrow();
    setProfile(db, 78, 184, 'm', 22);
    expect(() => requireProfile(db, 'status')).not.toThrow();
  });
  
  it('should validate profile data', () => {
    expect(() => setProfile(db, 20, 180, 'm', 22)).toThrow();
    expect(() => setProfile(db, 78, 100, 'm', 22)).toThrow();
    expect(() => setProfile(db, 78, 180, 'x', 22)).toThrow();
    expect(() => setProfile(db, 78, 180, 'm', 10)).toThrow();
  });
  
  it('should replace existing profile', () => {
    setProfile(db, 78, 184, 'm', 22);
    setProfile(db, 80, 185, 'f', 25);
    const profile = getProfile(db);
    expect(profile?.weight_kg).toBe(80);
  });
});
```

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/preset.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { savePreset, listPresets, getPreset, removePreset } from '../../src/commands/preset.js';

describe('preset commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should save and list presets', () => {
    savePreset(db, 'augustiner', 500, 5.2);
    const list = listPresets(db);
    expect(list.count).toBe(1);
    expect(list.items[0]?.name).toBe('augustiner');
  });
  
  it('should normalize preset names to lowercase', () => {
    savePreset(db, 'Augustiner', 500, 5.2);
    const preset = getPreset(db, 'augustiner');
    expect(preset.name).toBe('augustiner');
  });
  
  it('should reject invalid preset names', () => {
    expect(() => savePreset(db, 'Invalid Name!', 500, 5.2)).toThrow();
    expect(() => savePreset(db, '', 500, 5.2)).toThrow();
  });
  
  it('should remove presets', () => {
    savePreset(db, 'augustiner', 500, 5.2);
    removePreset(db, 'augustiner');
    const list = listPresets(db);
    expect(list.count).toBe(0);
  });
  
  it('should throw for unknown preset', () => {
    expect(() => getPreset(db, 'unknown')).toThrow();
  });
});
```

## Schritt 6.4: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Profile kann gesetzt und gelesen werden
- [ ] Profile-Validierung funktioniert
- [ ] `requireProfile` wirft `PROFILE_MISSING` wenn kein Profil existiert
- [ ] Presets können gespeichert, gelistet, gelesen und gelöscht werden
- [ ] Preset-Namen werden zu lowercase normalisiert
- [ ] Unbekannte Presets werfen `UNKNOWN_PRESET`
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 7: Session Management** (`07-session-management.md`)
