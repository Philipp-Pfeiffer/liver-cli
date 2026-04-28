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