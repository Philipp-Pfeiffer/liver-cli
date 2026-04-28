# Phase 2: Datenbank & Schema

## Ziel
SQLite-Datenbank mit better-sqlite3, Migrationssystem, Schema gemäß §7.2 der Spec.

## Schritt 2.1: Migrationssystem implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/db/migrate.ts`:

```typescript
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  
  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10);
    if (version > currentVersion) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    }
  }
}
```

## Schritt 2.2: Initiale Migration erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/db/migrations/001-init.sql`:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 0;

CREATE TABLE IF NOT EXISTS profile (
  weight_kg REAL NOT NULL CHECK(weight_kg >= 30 AND weight_kg <= 250),
  height_cm REAL NOT NULL CHECK(height_cm >= 120 AND height_cm <= 230),
  sex TEXT NOT NULL CHECK(sex IN ('m', 'f', 'o')),
  age INTEGER NOT NULL CHECK(age >= 16 AND age <= 120),
  preferred_formula TEXT CHECK(preferred_formula IN ('watson', 'widmark'))
);

CREATE TABLE IF NOT EXISTS presets (
  name TEXT PRIMARY KEY CHECK(
    length(name) >= 1 AND 
    length(name) <= 32 AND 
    name GLOB '[a-z0-9_-]*'
  ),
  volume_ml REAL NOT NULL CHECK(volume_ml > 0 AND volume_ml <= 5000),
  abv REAL NOT NULL CHECK(abv > 0 AND abv <= 100),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT CHECK(length(name) <= 64),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  stomach_initial TEXT NOT NULL CHECK(stomach_initial IN ('empty', 'some', 'full'))
);

CREATE TABLE IF NOT EXISTS stomach_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('empty', 'some', 'full'))
);

CREATE TABLE IF NOT EXISTS drinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  volume_ml REAL NOT NULL CHECK(volume_ml > 0 AND volume_ml <= 5000),
  abv REAL NOT NULL CHECK(abv > 0 AND abv <= 100),
  preset_name TEXT REFERENCES presets(name)
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Schritt 2.3: DB-Initialisierungs-Layer

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { migrate } from './migrate.js';

const LIVER_DIR = join(homedir(), '.liver');
const DB_PATH = join(LIVER_DIR, 'db.sqlite');

export function initDb(): Database.Database {
  mkdirSync(LIVER_DIR, { recursive: true });
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 0');
  
  migrate(db);
  
  return db;
}

export { Database };
```

## Schritt 2.4: DB-Test

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe('database schema', () => {
  it('should have all tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as Array<{ name: string }>;
    
    const names = tables.map(t => t.name);
    expect(names).toContain('profile');
    expect(names).toContain('presets');
    expect(names).toContain('sessions');
    expect(names).toContain('stomach_events');
    expect(names).toContain('drinks');
    expect(names).toContain('config');
  });
  
  it('should enforce profile constraints', () => {
    const insert = db.prepare(
      'INSERT INTO profile (weight_kg, height_cm, sex, age) VALUES (?, ?, ?, ?)'
    );
    
    expect(() => insert.run(70, 180, 'm', 25)).not.toThrow();
    expect(() => insert.run(20, 180, 'm', 25)).toThrow();
    expect(() => insert.run(300, 180, 'm', 25)).toThrow();
    expect(() => insert.run(70, 100, 'm', 25)).toThrow();
    expect(() => insert.run(70, 180, 'x', 25)).toThrow();
    expect(() => insert.run(70, 180, 'm', 10)).toThrow();
  });
  
  it('should enforce preset name constraints', () => {
    const insert = db.prepare(
      'INSERT INTO presets (name, volume_ml, abv, created_at) VALUES (?, ?, ?, ?)'
    );
    
    expect(() => insert.run('augustiner', 500, 5.2, '2026-04-28T00:00:00Z')).not.toThrow();
    expect(() => insert.run('INVALID NAME', 500, 5.2, '2026-04-28T00:00:00Z')).toThrow();
    expect(() => insert.run('', 500, 5.2, '2026-04-28T00:00:00Z')).toThrow();
  });
});
```

## Schritt 2.5: Tests ausführen

```bash
npm run test
```

Erwartet: Alle DB-Tests passen.

## Schritt 2.6: Lint

```bash
npm run lint
```

Sollte sauber sein.

## Erfolgskriterien

- [ ] Migrationssystem läuft korrekt
- [ ] `initDb()` erzeugt `~/.liver/db.sqlite`
- [ ] Alle Tabellen existieren mit korrekten Constraints
- [ ] DB-Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 3: WASM Integration** (`03-wasm-integration.md`)
